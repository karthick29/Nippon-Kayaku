import 'server-only';
import type {
  AuditLog,
  Company,
  CompanyEquipment,
  CompanyQuery,
  CompanyRow,
  CountBucket,
  DashboardMetrics,
  DocumentRecord,
  EquipmentKey,
  Paginated,
  Product,
  ProductCompanyRow,
  ProductQuery,
  ProductRow,
  SearchHit,
  User,
} from '@/lib/types';
import { bestMatch, scoreCas, scoreMatch } from '@/lib/search-core';
import { slugify } from '@/lib/slug';
import {
  APPLICATIONS,
  APPLICATION_BY_ID,
  CATEGORIES,
  CATEGORY_BY_ID,
  EQUIPMENT_MASTER,
  LOCATIONS,
  LOCATION_BY_ID,
} from '@/data/masters';
import { SEED_NOW } from '@/data/dataset';
import { getStore } from './store';
import type { Actor, CompanyInput, ProductInput, Repository } from './contract';

/* ════════════════════════════════════════════════════════════════════
   In-memory repository adapter.

   Implements the full Repository contract against the process-local
   store. Sorting, filtering, pagination, soft delete and audit trailing
   all behave exactly as the Prisma adapter does, so the UI cannot tell
   them apart.
   ════════════════════════════════════════════════════════════════════ */

const ALL_EQUIPMENT_KEYS = EQUIPMENT_MASTER.map((e) => e.key);

function paginate<T>(rows: T[], page = 1, pageSize = 25): Paginated<T> {
  const total = rows.length;
  const size = Math.max(1, Math.min(200, pageSize));
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;
  return { rows: rows.slice(start, start + size), total, page: current, pageSize: size, pageCount };
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function nowIso(): string {
  return new Date().toISOString();
}

function live<T extends { deletedAt?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deletedAt);
}

/* ── Row builders ───────────────────────────────────────────────── */

function toProductRow(product: Product): ProductRow {
  const store = getStore();
  const companyIds = store.links.filter((l) => l.productId === product.id).map((l) => l.companyId);
  const companies = live(store.companies)
    .filter((c) => companyIds.includes(c.id))
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, locationName: c.locationName }));

  return { ...product, companyCount: companies.length, companies };
}

function toCompanyRow(company: Company): CompanyRow {
  const store = getStore();
  const productCount = new Set(
    store.links.filter((l) => l.companyId === company.id).map((l) => l.productId),
  ).size;
  const equipmentCount = store.equipment.filter((e) => e.companyId === company.id && e.available).length;
  return { ...company, productCount, equipmentCount };
}

/** Company IDs that have every requested capability available. */
function companyIdsWithEquipment(keys: EquipmentKey[]): Set<string> {
  const store = getStore();
  const result = new Set<string>();
  for (const company of live(store.companies)) {
    const has = keys.every((k) =>
      store.equipment.some((e) => e.companyId === company.id && e.equipmentKey === k && e.available),
    );
    if (has) result.add(company.id);
  }
  return result;
}

/* ── Repository ─────────────────────────────────────────────────── */

export const memoryRepo: Repository = {
  /* ── Products ─────────────────────────────────────────────────── */

  async listProducts(query: ProductQuery): Promise<Paginated<ProductRow>> {
    const store = getStore();
    let rows = live(store.products).map(toProductRow);

    if (query.status?.length) rows = rows.filter((r) => query.status!.includes(r.status));
    if (query.applicationId?.length) rows = rows.filter((r) => query.applicationId!.includes(r.applicationId));
    if (query.categoryId?.length) rows = rows.filter((r) => query.categoryId!.includes(r.categoryId));

    if (query.companyId?.length) {
      rows = rows.filter((r) => r.companies.some((c) => query.companyId!.includes(c.id)));
    }

    if (query.locationId?.length) {
      const locationNames = new Set(
        query.locationId.map((id) => LOCATION_BY_ID.get(id)?.name).filter(Boolean) as string[],
      );
      rows = rows.filter((r) => r.companies.some((c) => locationNames.has(c.locationName)));
    }

    if (query.equipment?.length) {
      const capable = companyIdsWithEquipment(query.equipment);
      rows = rows.filter((r) => r.companies.some((c) => capable.has(c.id)));
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      const scored = rows
        .map((r) => {
          const m = bestMatch(q, [
            { name: 'name', value: r.name, weight: 1 },
            { name: 'casNumber', value: r.casNumber, weight: 1, cas: true },
            { name: 'synonyms', value: r.synonyms.join(' '), weight: 0.8 },
            { name: 'molecularFormula', value: r.molecularFormula, weight: 0.7 },
            { name: 'applicationName', value: r.applicationName, weight: 0.6 },
            { name: 'categoryName', value: r.categoryName, weight: 0.5 },
            { name: 'companies', value: r.companies.map((c) => c.name).join(' '), weight: 0.55 },
            { name: 'description', value: r.description, weight: 0.25 },
          ]);
          return { row: r, score: m.score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      rows = scored.map((s) => s.row);
      // Relevance order wins unless an explicit sort was requested.
      if (!query.sort) return paginate(rows, query.page, query.pageSize);
    }

    const sortKey = query.sort ?? 'name';
    const dir = query.dir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      return compare(av, bv) * dir;
    });

    return paginate(rows, query.page, query.pageSize);
  },

  async getProduct(idOrSlug: string): Promise<ProductRow | null> {
    const store = getStore();
    const product = live(store.products).find((p) => p.id === idOrSlug || p.slug === idOrSlug);
    return product ? toProductRow(product) : null;
  },

  async getProductCompanies(productId: string): Promise<ProductCompanyRow[]> {
    const store = getStore();
    const links = store.links.filter((l) => l.productId === productId);
    const rows: ProductCompanyRow[] = [];

    for (const link of links) {
      const company = store.companies.find((c) => c.id === link.companyId && !c.deletedAt);
      if (!company) continue; // company soft-deleted — drop the row, keep the link

      const equipment = {} as Record<EquipmentKey, CompanyEquipment | undefined>;
      for (const key of ALL_EQUIPMENT_KEYS) {
        equipment[key] = store.equipment.find((e) => e.companyId === company.id && e.equipmentKey === key);
      }

      rows.push({
        linkId: link.id,
        company,
        equipment,
        productCodes: link.productCodes,
        strength: link.strength,
        presentation: link.presentation,
        capital: link.capital,
        remarks: link.remarks,
        status: link.status,
      });
    }

    return rows.sort((a, b) => a.company.name.localeCompare(b.company.name));
  },

  async createProduct(input: ProductInput, actor: Actor): Promise<ProductRow> {
    const store = getStore();
    const id = `prd-${String(store.products.length + 1).padStart(3, '0')}-${Date.now().toString(36)}`;
    const timestamp = nowIso();

    const product: Product = {
      id,
      name: input.name,
      slug: slugify(input.name),
      casNumber: input.casNumber,
      smiles: input.smiles || undefined,
      inchiKey: input.inchiKey || undefined,
      molecularFormula: input.molecularFormula,
      molecularWeight: input.molecularWeight,
      applicationId: input.applicationId,
      applicationName: APPLICATION_BY_ID.get(input.applicationId)?.name ?? 'Unknown',
      categoryId: input.categoryId,
      categoryName: CATEGORY_BY_ID.get(input.categoryId)?.name ?? 'Unknown',
      status: input.status,
      description: input.description,
      synonyms: input.synonyms ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    store.products.unshift(product);

    (input.companies ?? []).forEach((c, i) => {
      store.links.push({
        id: `lnk-${id}-${i}`,
        productId: id,
        companyId: c.companyId,
        productCodes: c.productCodes.length ? c.productCodes : [`PR-${String(900 + i).padStart(3, '0')}`],
        strength: c.strength,
        presentation: c.presentation,
        remarks: c.remarks,
        capital: store.companies.find((co) => co.id === c.companyId)?.capital,
        status: input.status,
        createdAt: timestamp,
      });
    });

    await memoryRepo.recordAudit({
      action: 'CREATE',
      entity: 'product',
      entityId: id,
      entityLabel: product.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} added product ${product.name}`,
    });

    return toProductRow(product);
  },

  async updateProduct(id: string, input: Partial<ProductInput>, actor: Actor): Promise<ProductRow | null> {
    const store = getStore();
    const product = store.products.find((p) => p.id === id && !p.deletedAt);
    if (!product) return null;

    const changes: AuditLog['changes'] = {};
    const assign = <K extends keyof Product>(key: K, value: Product[K] | undefined) => {
      if (value === undefined || product[key] === value) return;
      changes[key as string] = { from: product[key], to: value };
      product[key] = value;
    };

    assign('name', input.name);
    if (input.name) product.slug = slugify(input.name);
    assign('casNumber', input.casNumber);
    // '' clears the structure — assign() only skips undefined.
    assign('smiles', input.smiles);
    assign('inchiKey', input.inchiKey);
    assign('molecularFormula', input.molecularFormula);
    assign('molecularWeight', input.molecularWeight);
    assign('status', input.status);
    assign('description', input.description);
    if (input.synonyms) product.synonyms = input.synonyms;

    if (input.applicationId) {
      assign('applicationId', input.applicationId);
      product.applicationName = APPLICATION_BY_ID.get(input.applicationId)?.name ?? product.applicationName;
    }
    if (input.categoryId) {
      assign('categoryId', input.categoryId);
      product.categoryName = CATEGORY_BY_ID.get(input.categoryId)?.name ?? product.categoryName;
    }

    product.updatedAt = nowIso();

    await memoryRepo.recordAudit({
      action: 'UPDATE',
      entity: 'product',
      entityId: id,
      entityLabel: product.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} updated product ${product.name}`,
      changes: Object.keys(changes).length ? changes : undefined,
    });

    return toProductRow(product);
  },

  async deleteProducts(ids: string[], actor: Actor): Promise<number> {
    const store = getStore();
    let count = 0;

    for (const id of ids) {
      const product = store.products.find((p) => p.id === id && !p.deletedAt);
      if (!product) continue;
      product.deletedAt = nowIso(); // soft delete — recoverable, audit-visible
      count += 1;

      await memoryRepo.recordAudit({
        action: 'DELETE',
        entity: 'product',
        entityId: id,
        entityLabel: product.name,
        actorId: actor.id,
        actorName: actor.name,
        summary: `${actor.name} deleted product ${product.name}`,
      });
    }

    return count;
  },

  async duplicateProduct(id: string, actor: Actor): Promise<ProductRow | null> {
    const store = getStore();
    const source = store.products.find((p) => p.id === id && !p.deletedAt);
    if (!source) return null;

    const links = store.links.filter((l) => l.productId === id);

    return memoryRepo.createProduct(
      {
        name: `${source.name} (copy)`,
        casNumber: source.casNumber,
        smiles: source.smiles,
        inchiKey: source.inchiKey,
        molecularFormula: source.molecularFormula,
        molecularWeight: source.molecularWeight,
        applicationId: source.applicationId,
        categoryId: source.categoryId,
        status: 'Development',
        description: source.description,
        synonyms: source.synonyms,
        companies: links.map((l) => ({
          companyId: l.companyId,
          productCodes: l.productCodes,
          strength: l.strength,
          presentation: l.presentation,
          remarks: l.remarks,
        })),
      },
      actor,
    );
  },

  /* ── Companies ────────────────────────────────────────────────── */

  async listCompanies(query: CompanyQuery): Promise<Paginated<CompanyRow>> {
    const store = getStore();
    let rows = live(store.companies).map(toCompanyRow);

    if (query.locationId?.length) rows = rows.filter((r) => query.locationId!.includes(r.locationId));
    if (query.minStaff) rows = rows.filter((r) => r.chemicalStaff >= query.minStaff!);
    if (query.equipment?.length) {
      const capable = companyIdsWithEquipment(query.equipment);
      rows = rows.filter((r) => capable.has(r.id));
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      rows = rows
        .map((r) => ({
          row: r,
          score: bestMatch(q, [
            { name: 'name', value: r.name, weight: 1 },
            { name: 'locationName', value: r.locationName, weight: 0.7 },
            { name: 'strength', value: r.strength, weight: 0.6 },
            { name: 'remarks', value: r.remarks, weight: 0.3 },
          ]).score,
        }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.row);

      if (!query.sort) return paginate(rows, query.page, query.pageSize);
    }

    const sortKey = query.sort ?? 'name';
    const dir = query.dir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      return compare(av, bv) * dir;
    });

    return paginate(rows, query.page, query.pageSize);
  },

  async getCompany(idOrSlug: string): Promise<CompanyRow | null> {
    const store = getStore();
    const company = live(store.companies).find((c) => c.id === idOrSlug || c.slug === idOrSlug);
    return company ? toCompanyRow(company) : null;
  },

  async getCompanyEquipment(companyId: string): Promise<CompanyEquipment[]> {
    const store = getStore();
    const order = new Map(EQUIPMENT_MASTER.map((e, i) => [e.key, i]));
    return store.equipment
      .filter((e) => e.companyId === companyId)
      .sort((a, b) => (order.get(a.equipmentKey) ?? 99) - (order.get(b.equipmentKey) ?? 99));
  },

  async getCompanyProducts(companyId: string): Promise<ProductRow[]> {
    const store = getStore();
    const productIds = new Set(store.links.filter((l) => l.companyId === companyId).map((l) => l.productId));
    return live(store.products)
      .filter((p) => productIds.has(p.id))
      .map(toProductRow)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async createCompany(input: CompanyInput, actor: Actor): Promise<CompanyRow> {
    const store = getStore();
    const id = `cmp-${String(store.companies.length + 1).padStart(3, '0')}-${Date.now().toString(36)}`;
    const timestamp = nowIso();

    const company: Company = {
      id,
      name: input.name,
      slug: slugify(input.name),
      locationId: input.locationId,
      locationName: LOCATION_BY_ID.get(input.locationId)?.name ?? 'Unknown',
      chemicalStaff: input.chemicalStaff,
      phdCount: input.phdCount,
      established: input.established,
      capital: input.capital,
      strength: input.strength,
      presentation: input.presentation,
      remarks: input.remarks,
      website: input.website,
      contactEmail: input.contactEmail,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    store.companies.push(company);

    // Seed an empty capability row per equipment type so the Equipment
    // tab renders a complete, editable matrix from day one.
    for (const eq of EQUIPMENT_MASTER) {
      store.equipment.push({
        id: `${id}-${eq.key}`,
        companyId: id,
        equipmentKey: eq.key,
        available: false,
      });
    }

    await memoryRepo.recordAudit({
      action: 'CREATE',
      entity: 'company',
      entityId: id,
      entityLabel: company.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} added company ${company.name}`,
    });

    return toCompanyRow(company);
  },

  async updateCompany(id: string, input: Partial<CompanyInput>, actor: Actor): Promise<CompanyRow | null> {
    const store = getStore();
    const company = store.companies.find((c) => c.id === id && !c.deletedAt);
    if (!company) return null;

    Object.assign(company, input);
    if (input.name) company.slug = slugify(input.name);
    if (input.locationId) company.locationName = LOCATION_BY_ID.get(input.locationId)?.name ?? company.locationName;
    company.updatedAt = nowIso();

    await memoryRepo.recordAudit({
      action: 'UPDATE',
      entity: 'company',
      entityId: id,
      entityLabel: company.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} updated company ${company.name}`,
    });

    return toCompanyRow(company);
  },

  async deleteCompanies(ids: string[], actor: Actor): Promise<number> {
    const store = getStore();
    let count = 0;

    for (const id of ids) {
      const company = store.companies.find((c) => c.id === id && !c.deletedAt);
      if (!company) continue;
      company.deletedAt = nowIso();
      count += 1;

      await memoryRepo.recordAudit({
        action: 'DELETE',
        entity: 'company',
        entityId: id,
        entityLabel: company.name,
        actorId: actor.id,
        actorName: actor.name,
        summary: `${actor.name} deleted company ${company.name}`,
      });
    }

    return count;
  },

  /* ── Unified search ───────────────────────────────────────────── */

  async search(q: string, opts): Promise<SearchHit[]> {
    const query = q.trim();
    if (!query) return [];

    const limit = opts?.limit ?? 20;
    const types = opts?.types ?? (['product', 'company', 'application', 'location'] as SearchHit['type'][]);
    const store = getStore();
    const hits: SearchHit[] = [];

    if (types.includes('product')) {
      for (const p of live(store.products)) {
        const m = bestMatch(query, [
          { name: 'Product name', value: p.name, weight: 1 },
          { name: 'CAS number', value: p.casNumber, weight: 1, cas: true },
          { name: 'Synonym', value: p.synonyms.join(' | '), weight: 0.85 },
          { name: 'Formula', value: p.molecularFormula, weight: 0.7 },
          { name: 'Application', value: p.applicationName, weight: 0.5 },
        ]);
        if (m.score > 0) {
          hits.push({
            type: 'product',
            id: p.id,
            slug: p.slug,
            title: p.name,
            subtitle: `${p.casNumber} · ${p.applicationName}`,
            matchedField: m.field,
            matchedValue: m.value,
            score: m.score * 1.1, // products are the primary entity
            href: `/products/${p.slug}`,
          });
        }
      }
    }

    if (types.includes('company')) {
      for (const c of live(store.companies)) {
        const m = bestMatch(query, [
          { name: 'Company name', value: c.name, weight: 1 },
          { name: 'Location', value: c.locationName, weight: 0.7 },
          { name: 'Strength', value: c.strength, weight: 0.6 },
        ]);
        if (m.score > 0) {
          hits.push({
            type: 'company',
            id: c.id,
            slug: c.slug,
            title: c.name,
            subtitle: `${c.locationName} · ${c.chemicalStaff} chemical staff`,
            matchedField: m.field,
            matchedValue: m.value,
            score: m.score,
            href: `/companies/${c.slug}`,
          });
        }
      }
    }

    if (types.includes('application')) {
      for (const a of APPLICATIONS) {
        const score = scoreMatch(query, a.name);
        if (score > 0) {
          hits.push({
            type: 'application',
            id: a.id,
            slug: a.slug,
            title: a.name,
            subtitle: 'Application',
            matchedField: 'Application',
            matchedValue: a.name,
            score: score * 0.75,
            href: `/search?application=${a.id}`,
          });
        }
      }
    }

    if (types.includes('location')) {
      for (const l of LOCATIONS) {
        const score = scoreMatch(query, l.name);
        if (score > 0) {
          hits.push({
            type: 'location',
            id: l.id,
            slug: l.slug,
            title: l.name,
            subtitle: `${l.state} · Location`,
            matchedField: 'Location',
            matchedValue: l.name,
            score: score * 0.7,
            href: `/companies?location=${l.id}`,
          });
        }
      }
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  },

  /* ── Analytics ────────────────────────────────────────────────── */

  async dashboard(): Promise<DashboardMetrics> {
    const store = getStore();
    const products = live(store.products);
    const companies = live(store.companies);

    const countBy = <T>(items: T[], key: (t: T) => string | undefined): Map<string, number> => {
      const map = new Map<string, number>();
      for (const item of items) {
        const k = key(item);
        if (!k) continue;
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return map;
    };

    const byApplicationMap = countBy(products, (p) => p.applicationId);
    const byApplication: CountBucket[] = APPLICATIONS.map((a) => ({
      key: a.id,
      label: a.name,
      value: byApplicationMap.get(a.id) ?? 0,
      colorKey: a.colorKey,
    }))
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value);

    const byStatusMap = countBy(products, (p) => p.status);
    const byStatus: CountBucket[] = ['Commercial', 'Development', 'Pilot', 'Discontinued']
      .map((s) => ({ key: s, label: s, value: byStatusMap.get(s) ?? 0 }))
      .filter((b) => b.value > 0);

    const byCityMap = countBy(companies, (c) => c.locationId);
    const byCity: CountBucket[] = LOCATIONS.map((l) => ({
      key: l.id,
      label: l.name,
      value: byCityMap.get(l.id) ?? 0,
    }))
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value);

    const byCategoryMap = countBy(products, (p) => p.categoryId);
    const byCategory: CountBucket[] = CATEGORIES.map((c) => ({
      key: c.id,
      label: c.name,
      value: byCategoryMap.get(c.id) ?? 0,
    })).filter((b) => b.value > 0);

    const linksByCompany = countBy(store.links, (l) => l.companyId);
    const topCompanies: CountBucket[] = companies
      .map((c) => ({ key: c.id, label: c.name, value: linksByCompany.get(c.id) ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const equipmentAvailability: CountBucket[] = EQUIPMENT_MASTER.map((eq) => ({
      key: eq.key,
      label: eq.name,
      value: store.equipment.filter((e) => e.equipmentKey === eq.key && e.available).length,
    })).sort((a, b) => b.value - a.value);

    // 12-month rolling additions, anchored to the seed reference date.
    const monthlyAdditions: Array<{ month: string; products: number; companies: number }> = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(SEED_NOW.getUTCFullYear(), SEED_NOW.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthlyAdditions.push({
        month: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
        products: products.filter((p) => p.createdAt.startsWith(key)).length,
        companies: companies.filter((c) => c.createdAt.startsWith(key)).length,
      });
    }

    const thirtyDaysAgo = new Date(SEED_NOW.getTime() - 30 * 86_400_000).toISOString();

    const recentProducts = [...products]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map(toProductRow);

    return {
      totalProducts: products.length,
      commercialProducts: byStatusMap.get('Commercial') ?? 0,
      developmentProducts: byStatusMap.get('Development') ?? 0,
      pilotProducts: byStatusMap.get('Pilot') ?? 0,
      totalCompanies: companies.length,
      totalLocations: byCity.length,
      totalApplications: byApplication.length,
      totalLinks: store.links.length,
      avgCompaniesPerProduct: products.length ? Number((store.links.length / products.length).toFixed(1)) : 0,
      productsAddedLast30d: products.filter((p) => p.createdAt >= thirtyDaysAgo).length,
      byApplication,
      byStatus,
      byCity,
      byCategory,
      topCompanies,
      equipmentAvailability,
      monthlyAdditions,
      recentProducts,
      recentActivity: store.auditLogs.slice(0, 8),
    };
  },

  async equipmentCoverage() {
    const store = getStore();
    const total = live(store.companies).length || 1;
    return EQUIPMENT_MASTER.map((eq) => {
      const companies = store.equipment.filter((e) => e.equipmentKey === eq.key && e.available).length;
      return { key: eq.key, name: eq.name, companies, pct: Math.round((companies / total) * 100) };
    }).sort((a, b) => b.companies - a.companies);
  },

  /* ── Supporting entities ──────────────────────────────────────── */

  async listAuditLogs(limit = 50): Promise<AuditLog[]> {
    return getStore().auditLogs.slice(0, limit);
  },

  async listEntityAuditLogs(entityId: string, limit = 25): Promise<AuditLog[]> {
    return getStore()
      .auditLogs.filter((l) => l.entityId === entityId)
      .slice(0, limit);
  },

  async listDocuments(scope): Promise<DocumentRecord[]> {
    const store = getStore();
    return store.documents
      .filter((d) =>
        scope.productId ? d.productId === scope.productId : scope.companyId ? d.companyId === scope.companyId : false,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listUsers(): Promise<User[]> {
    return [...getStore().users].sort((a, b) => a.name.localeCompare(b.name));
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return getStore().users.find((u) => u.email.toLowerCase() === normalized) ?? null;
  },

  async recordAudit(entry): Promise<AuditLog> {
    const store = getStore();
    const log: AuditLog = {
      ...entry,
      id: `aud-${Date.now().toString(36)}-${store.auditLogs.length}`,
      createdAt: nowIso(),
    };
    store.auditLogs.unshift(log);
    return log;
  },

  async allCompanies(): Promise<Company[]> {
    return live(getStore().companies);
  },

  async allProducts(): Promise<Product[]> {
    return live(getStore().products);
  },
};

/** Re-exported for report builders that need CAS-aware matching. */
export { scoreCas };
