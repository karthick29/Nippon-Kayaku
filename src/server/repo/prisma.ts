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
  ProductStatus,
  ProductSummary,
  Role,
  RouteInputRole,
  RouteReviewStatus,
  SearchHit,
  StructureQuery,
  StructureSearchResult,
  SynthesisRoute,
  SynthesisRouteView,
  User,
  WhereUsedEntry,
} from '@/lib/types';
import { routeEdges, traceConsumers, type RouteEdge } from '@/lib/synthesis';
import { assertRouteWritable, routeChanges } from '@/server/synthesis';
import { runStructureSearch } from '@/server/chem/structure-search';
import { bestMatch, scoreMatch } from '@/lib/search-core';
import { slugify } from '@/lib/slug';
import { APPLICATIONS, EQUIPMENT_MASTER, LOCATIONS } from '@/data/masters';
import type { Actor, CompanyInput, ProductInput, Repository, RouteWriteInput } from './contract';

/* ════════════════════════════════════════════════════════════════════
   PostgreSQL adapter.

   Enabled with ASTRA_DATA_SOURCE=prisma and a DATABASE_URL. Implements
   the same Repository contract as the in-memory adapter, so nothing
   above this file changes when you switch.

   Setup:
     npm run db:generate && npm run db:push && npm run db:seed

   Typing note: the Prisma client is loaded through a structural type
   rather than the generated one, so `npm run typecheck` passes before
   `prisma generate` has ever run. Once you generate, swap
   `PrismaLike` for `PrismaClient` to get full model typing back.
   ════════════════════════════════════════════════════════════════════ */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Delegate = {
  findMany: (args?: any) => Promise<any[]>;
  findFirst: (args?: any) => Promise<any>;
  findUnique: (args?: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  updateMany: (args: any) => Promise<{ count: number }>;
  count: (args?: any) => Promise<number>;
  groupBy?: (args: any) => Promise<any[]>;
};

interface PrismaLike {
  product: Delegate;
  company: Delegate;
  productCompany: Delegate;
  companyEquipment: Delegate;
  equipmentMaster: Delegate;
  application: Delegate;
  productCategory: Delegate;
  companyLocation: Delegate;
  user: Delegate;
  auditLog: Delegate;
  document: Delegate;
  synthesisRoute: Delegate;
  routeInput: Delegate;
  $disconnect: () => Promise<void>;
}

declare global {
  // eslint-disable-next-line no-var
  var __astraPrisma: PrismaLike | undefined;
}

function client(): PrismaLike {
  if (!globalThis.__astraPrisma) {
    // Required lazily so a missing generated client cannot break the
    // in-memory default path at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client');
    globalThis.__astraPrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    }) as PrismaLike;
  }
  return globalThis.__astraPrisma;
}

/* ── Enum mapping ───────────────────────────────────────────────── */

const TO_DB: Record<ProductStatus, string> = {
  Commercial: 'COMMERCIAL',
  Development: 'DEVELOPMENT',
  Pilot: 'PILOT',
  Discontinued: 'DISCONTINUED',
};

const FROM_DB: Record<string, ProductStatus> = {
  COMMERCIAL: 'Commercial',
  DEVELOPMENT: 'Development',
  PILOT: 'Pilot',
  DISCONTINUED: 'Discontinued',
};

const ROLE_TO_DB: Record<RouteInputRole, string> = {
  'building-block': 'BUILDING_BLOCK',
  reagent: 'REAGENT',
  catalyst: 'CATALYST',
  solvent: 'SOLVENT',
};
const ROLE_FROM_DB: Record<string, RouteInputRole> = Object.fromEntries(
  Object.entries(ROLE_TO_DB).map(([app, db]) => [db, app as RouteInputRole]),
);
const REVIEW_TO_DB: Record<RouteReviewStatus, string> = { unreviewed: 'UNREVIEWED', reviewed: 'REVIEWED' };

/* ── Row mapping ────────────────────────────────────────────────── */

const PRODUCT_INCLUDE = {
  application: true,
  category: true,
  companies: { include: { company: { include: { location: true } } } },
} as const;

/** Enough of a product to render it inside a route or where-used list. */
const SUMMARY_INCLUDE = { companies: { include: { company: true } } } as const;

const ROUTE_INCLUDE = {
  inputs: { orderBy: { sortOrder: 'asc' }, include: { product: { include: SUMMARY_INCLUDE } } },
} as const;

function mapSummary(row: any): ProductSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    casNumber: row.casNumber,
    smiles: row.smiles ?? undefined,
    status: FROM_DB[row.status] ?? 'Development',
    companyCount: (row.companies ?? []).filter((link: any) => link.company && !link.company.deletedAt).length,
    deleted: Boolean(row.deletedAt),
  };
}

function mapRoute(row: any): SynthesisRoute {
  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    isPreferred: row.isPreferred,
    reviewStatus: row.reviewStatus === 'REVIEWED' ? 'reviewed' : 'unreviewed',
    notes: row.notes ?? undefined,
    inputs: (row.inputs ?? []).map((input: any) => ({
      id: input.id,
      routeId: input.routeId,
      role: ROLE_FROM_DB[input.role] ?? 'building-block',
      sortOrder: input.sortOrder,
      productId: input.productId ?? undefined,
      externalName: input.externalName ?? undefined,
      externalCas: input.externalCas ?? undefined,
      externalSmiles: input.externalSmiles ?? undefined,
      quantity: input.quantity ?? undefined,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function mapRouteView(row: any): SynthesisRouteView {
  const route = mapRoute(row);
  return {
    ...route,
    inputs: route.inputs.map((input, index) => {
      const product = row.inputs[index]?.product;
      return product ? { ...input, product: mapSummary(product) } : input;
    }),
  };
}

function toInputRows(inputs: RouteWriteInput['inputs']) {
  return inputs.map((input, index) => ({
    role: ROLE_TO_DB[input.role],
    sortOrder: index,
    productId: input.productId ?? null,
    externalName: input.externalName ?? null,
    externalCas: input.externalCas ?? null,
    externalSmiles: input.externalSmiles ?? null,
    quantity: input.quantity ?? null,
  }));
}

/** Live routes as graph edges, optionally without the route being edited. */
async function loadEdges(excludeRouteId?: string): Promise<RouteEdge[]> {
  const rows = await client().synthesisRoute.findMany({
    where: { deletedAt: null, ...(excludeRouteId ? { id: { not: excludeRouteId } } : {}) },
    include: { inputs: true },
  });
  return routeEdges(rows.map(mapRoute));
}

/** Names of the active catalogue products among `ids` — what assertRouteWritable needs, fetched up front. */
async function activeNames(ids: Array<string | undefined>): Promise<Map<string, string>> {
  const wanted = ids.filter((id): id is string => Boolean(id));
  if (!wanted.length) return new Map();
  const rows = await client().product.findMany({ where: { id: { in: wanted }, deletedAt: null }, select: { id: true, name: true } });
  return new Map(rows.map((r: any) => [r.id, r.name]));
}

const COMPANY_INCLUDE = {
  location: true,
  equipment: { include: { equipment: true } },
  products: true,
} as const;

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    casNumber: row.casNumber,
    smiles: row.smiles ?? undefined,
    inchiKey: row.inchiKey ?? undefined,
    molecularFormula: row.molecularFormula ?? undefined,
    molecularWeight: row.molecularWeight ? Number(row.molecularWeight) : undefined,
    applicationId: row.applicationId,
    applicationName: row.application?.name ?? 'Unknown',
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? 'Unknown',
    status: FROM_DB[row.status] ?? 'Development',
    description: row.description ?? undefined,
    synonyms: row.synonyms ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function mapProductRow(row: any): ProductRow {
  const companies = (row.companies ?? [])
    .filter((link: any) => link.company && !link.company.deletedAt)
    .map((link: any) => ({
      id: link.company.id,
      name: link.company.name,
      slug: link.company.slug,
      locationName: link.company.location?.name ?? 'Unknown',
    }));

  return { ...mapProduct(row), companyCount: companies.length, companies };
}

function mapCompany(row: any): Company {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    locationId: row.locationId,
    locationName: row.location?.name ?? 'Unknown',
    chemicalStaff: row.chemicalStaff,
    phdCount: row.phdCount,
    established: row.established,
    capital: row.capital ?? undefined,
    strength: row.strength ?? undefined,
    presentation: row.presentation ?? undefined,
    remarks: row.remarks ?? undefined,
    website: row.website ?? undefined,
    contactEmail: row.contactEmail ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function mapCompanyRow(row: any): CompanyRow {
  return {
    ...mapCompany(row),
    productCount: new Set((row.products ?? []).map((p: any) => p.productId)).size,
    equipmentCount: (row.equipment ?? []).filter((e: any) => e.available).length,
  };
}

function mapEquipment(row: any): CompanyEquipment {
  return {
    id: row.id,
    companyId: row.companyId,
    equipmentKey: (row.equipment?.key ?? row.equipmentKey) as EquipmentKey,
    available: row.available,
    count: row.count ?? undefined,
    specification: row.specification ?? undefined,
    capacity: row.capacity ?? undefined,
    remarks: row.remarks ?? undefined,
  };
}

function mapAudit(row: any): AuditLog {
  return {
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    actorId: row.actorId ?? 'system',
    actorName: row.actorName,
    summary: row.summary,
    changes: row.changes ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: (row.role?.key ?? 'VIEWER') as Role,
    title: row.title ?? undefined,
    active: row.active,
    lastActiveAt: row.lastActiveAt ? row.lastActiveAt.toISOString() : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function paginate<T>(rows: T[], page = 1, pageSize = 25): Paginated<T> {
  const total = rows.length;
  const size = Math.max(1, Math.min(200, pageSize));
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;
  return { rows: rows.slice(start, start + size), total, page: current, pageSize: size, pageCount };
}

const ORDERABLE = new Set(['name', 'casNumber', 'status', 'createdAt', 'updatedAt', 'established', 'chemicalStaff', 'phdCount']);

/* ── Adapter ────────────────────────────────────────────────────── */

export const prismaRepo: Repository = {
  async listProducts(query: ProductQuery): Promise<Paginated<ProductRow>> {
    const db = client();

    // Structural filters run in SQL; fuzzy text ranking runs in memory
    // over the filtered set, because Postgres LIKE cannot reproduce the
    // subsequence scoring used everywhere else. For a large corpus,
    // replace this with a pg_trgm similarity index — see
    // docs/ARCHITECTURE.md § Search.
    const where: Record<string, unknown> = { deletedAt: null };
    if (query.status?.length) where.status = { in: query.status.map((s) => TO_DB[s]) };
    if (query.applicationId?.length) where.applicationId = { in: query.applicationId };
    if (query.categoryId?.length) where.categoryId = { in: query.categoryId };

    const companyFilter: Record<string, unknown> = {};
    if (query.companyId?.length) companyFilter.companyId = { in: query.companyId };
    if (query.locationId?.length) companyFilter.company = { locationId: { in: query.locationId } };
    if (query.equipment?.length) {
      companyFilter.company = {
        ...(companyFilter.company as object),
        equipment: {
          some: { available: true, equipment: { key: { in: query.equipment } } },
        },
      };
    }
    if (Object.keys(companyFilter).length) where.companies = { some: companyFilter };

    const orderBy =
      query.sort && ORDERABLE.has(query.sort) ? { [query.sort]: query.dir ?? 'asc' } : { name: 'asc' as const };

    const records = await db.product.findMany({ where, include: PRODUCT_INCLUDE, orderBy });
    let rows = records.map(mapProductRow);

    if (query.q?.trim()) {
      const q = query.q.trim();
      rows = rows
        .map((r) => ({
          row: r,
          score: bestMatch(q, [
            { name: 'name', value: r.name, weight: 1 },
            { name: 'casNumber', value: r.casNumber, weight: 1, cas: true },
            { name: 'synonyms', value: r.synonyms.join(' '), weight: 0.8 },
            { name: 'molecularFormula', value: r.molecularFormula, weight: 0.7 },
            { name: 'applicationName', value: r.applicationName, weight: 0.6 },
            { name: 'companies', value: r.companies.map((c) => c.name).join(' '), weight: 0.55 },
            { name: 'description', value: r.description, weight: 0.25 },
          ]).score,
        }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.row);
    }

    return paginate(rows, query.page, query.pageSize);
  },

  async getProduct(idOrSlug: string): Promise<ProductRow | null> {
    const db = client();
    const row = await db.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    return row ? mapProductRow(row) : null;
  },

  async getProductCompanies(productId: string): Promise<ProductCompanyRow[]> {
    const db = client();
    const links = await db.productCompany.findMany({
      where: { productId, company: { deletedAt: null } },
      include: { company: { include: COMPANY_INCLUDE } },
      orderBy: { company: { name: 'asc' } },
    });

    return links.map((link: any) => {
      const equipment = {} as Record<EquipmentKey, CompanyEquipment | undefined>;
      for (const spec of EQUIPMENT_MASTER) {
        const entry = (link.company.equipment ?? []).find((e: any) => e.equipment?.key === spec.key);
        equipment[spec.key] = entry ? mapEquipment(entry) : undefined;
      }

      return {
        linkId: link.id,
        company: mapCompany(link.company),
        equipment,
        productCodes: link.productCodes ?? [],
        strength: link.strength ?? undefined,
        presentation: link.presentation ?? undefined,
        capital: link.capital ?? undefined,
        remarks: link.remarks ?? undefined,
        status: FROM_DB[link.status] ?? 'Development',
      };
    });
  },

  async createProduct(input: ProductInput, actor: Actor): Promise<ProductRow> {
    const db = client();

    const created = await db.product.create({
      data: {
        name: input.name,
        slug: slugify(input.name),
        casNumber: input.casNumber,
        smiles: input.smiles || null,
        inchiKey: input.inchiKey || null,
        molecularFormula: input.molecularFormula ?? null,
        molecularWeight: input.molecularWeight ?? null,
        applicationId: input.applicationId,
        categoryId: input.categoryId,
        status: TO_DB[input.status],
        description: input.description ?? null,
        synonyms: input.synonyms ?? [],
        companies: input.companies?.length
          ? {
              create: input.companies.map((c) => ({
                companyId: c.companyId,
                productCodes: c.productCodes,
                strength: c.strength ?? null,
                presentation: c.presentation ?? null,
                remarks: c.remarks ?? null,
                status: TO_DB[input.status],
              })),
            }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    await prismaRepo.recordAudit({
      action: 'CREATE',
      entity: 'product',
      entityId: created.id,
      entityLabel: created.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} added product ${created.name}`,
    });

    return mapProductRow(created);
  },

  async updateProduct(id: string, input: Partial<ProductInput>, actor: Actor): Promise<ProductRow | null> {
    const db = client();
    const existing = await db.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!existing || existing.deletedAt) return null;

    const data: Record<string, unknown> = {};
    const changes: AuditLog['changes'] = {};
    const set = (key: string, value: unknown, current: unknown) => {
      if (value === undefined || value === current) return;
      data[key] = value;
      changes[key] = { from: current, to: value };
    };

    set('name', input.name, existing.name);
    if (input.name) data.slug = slugify(input.name);
    set('casNumber', input.casNumber, existing.casNumber);
    // '' clears the structure; stored as NULL.
    if (input.smiles !== undefined) set('smiles', input.smiles || null, existing.smiles);
    if (input.inchiKey !== undefined) set('inchiKey', input.inchiKey || null, existing.inchiKey);
    set('molecularFormula', input.molecularFormula, existing.molecularFormula);
    set('molecularWeight', input.molecularWeight, existing.molecularWeight);
    set('applicationId', input.applicationId, existing.applicationId);
    set('categoryId', input.categoryId, existing.categoryId);
    set('description', input.description, existing.description);
    if (input.status) set('status', TO_DB[input.status], existing.status);
    if (input.synonyms) data.synonyms = input.synonyms;

    const updated = await db.product.update({ where: { id }, data, include: PRODUCT_INCLUDE });

    await prismaRepo.recordAudit({
      action: 'UPDATE',
      entity: 'product',
      entityId: id,
      entityLabel: updated.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} updated product ${updated.name}`,
      changes: Object.keys(changes).length ? changes : undefined,
    });

    return mapProductRow(updated);
  },

  async deleteProducts(ids: string[], actor: Actor): Promise<number> {
    const db = client();
    const targets = await db.product.findMany({ where: { id: { in: ids }, deletedAt: null } });
    if (targets.length === 0) return 0;

    // Soft delete — the row and its history survive.
    const result = await db.product.updateMany({
      where: { id: { in: targets.map((t: any) => t.id) } },
      data: { deletedAt: new Date() },
    });

    for (const target of targets) {
      await prismaRepo.recordAudit({
        action: 'DELETE',
        entity: 'product',
        entityId: target.id,
        entityLabel: target.name,
        actorId: actor.id,
        actorName: actor.name,
        summary: `${actor.name} deleted product ${target.name}`,
      });
    }

    return result.count;
  },

  async duplicateProduct(id: string, actor: Actor): Promise<ProductRow | null> {
    const db = client();
    const source = await db.product.findFirst({
      where: { id, deletedAt: null },
      include: { companies: true },
    });
    if (!source) return null;

    return prismaRepo.createProduct(
      {
        name: `${source.name} (copy)`,
        casNumber: source.casNumber,
        smiles: source.smiles ?? undefined,
        inchiKey: source.inchiKey ?? undefined,
        molecularFormula: source.molecularFormula ?? undefined,
        molecularWeight: source.molecularWeight ? Number(source.molecularWeight) : undefined,
        applicationId: source.applicationId,
        categoryId: source.categoryId,
        status: 'Development',
        description: source.description ?? undefined,
        synonyms: source.synonyms ?? [],
        companies: (source.companies ?? []).map((c: any) => ({
          companyId: c.companyId,
          productCodes: c.productCodes ?? [],
          strength: c.strength ?? undefined,
          presentation: c.presentation ?? undefined,
          remarks: c.remarks ?? undefined,
        })),
      },
      actor,
    );
  },

  async listCompanies(query: CompanyQuery): Promise<Paginated<CompanyRow>> {
    const db = client();

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.locationId?.length) where.locationId = { in: query.locationId };
    if (query.minStaff) where.chemicalStaff = { gte: query.minStaff };
    if (query.equipment?.length) {
      where.AND = query.equipment.map((key) => ({
        equipment: { some: { available: true, equipment: { key } } },
      }));
    }

    const orderBy =
      query.sort && ORDERABLE.has(query.sort) ? { [query.sort]: query.dir ?? 'asc' } : { name: 'asc' as const };

    const records = await db.company.findMany({ where, include: COMPANY_INCLUDE, orderBy });
    let rows = records.map(mapCompanyRow);

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
    }

    return paginate(rows, query.page, query.pageSize);
  },

  async getCompany(idOrSlug: string): Promise<CompanyRow | null> {
    const db = client();
    const row = await db.company.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
      include: COMPANY_INCLUDE,
    });
    return row ? mapCompanyRow(row) : null;
  },

  async getCompanyEquipment(companyId: string): Promise<CompanyEquipment[]> {
    const db = client();
    const rows = await db.companyEquipment.findMany({
      where: { companyId },
      include: { equipment: true },
      orderBy: { equipment: { sortOrder: 'asc' } },
    });
    return rows.map(mapEquipment);
  },

  async getCompanyProducts(companyId: string): Promise<ProductRow[]> {
    const db = client();
    const rows = await db.product.findMany({
      where: { deletedAt: null, companies: { some: { companyId } } },
      include: PRODUCT_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return rows.map(mapProductRow);
  },

  async createCompany(input: CompanyInput, actor: Actor): Promise<CompanyRow> {
    const db = client();
    const masters = await db.equipmentMaster.findMany();

    const created = await db.company.create({
      data: {
        name: input.name,
        slug: slugify(input.name),
        locationId: input.locationId,
        chemicalStaff: input.chemicalStaff,
        phdCount: input.phdCount,
        established: input.established,
        capital: input.capital ?? null,
        strength: input.strength ?? null,
        presentation: input.presentation ?? null,
        remarks: input.remarks ?? null,
        website: input.website ?? null,
        contactEmail: input.contactEmail ?? null,
        // Seed an empty capability row per type so the Equipment tab is
        // a complete, editable matrix from day one.
        equipment: { create: masters.map((m: any) => ({ equipmentId: m.id, available: false })) },
      },
      include: COMPANY_INCLUDE,
    });

    await prismaRepo.recordAudit({
      action: 'CREATE',
      entity: 'company',
      entityId: created.id,
      entityLabel: created.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} added company ${created.name}`,
    });

    return mapCompanyRow(created);
  },

  async updateCompany(id: string, input: Partial<CompanyInput>, actor: Actor): Promise<CompanyRow | null> {
    const db = client();
    const existing = await db.company.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) return null;

    const updated = await db.company.update({
      where: { id },
      data: { ...input, ...(input.name ? { slug: slugify(input.name) } : {}) },
      include: COMPANY_INCLUDE,
    });

    await prismaRepo.recordAudit({
      action: 'UPDATE',
      entity: 'company',
      entityId: id,
      entityLabel: updated.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} updated company ${updated.name}`,
    });

    return mapCompanyRow(updated);
  },

  async deleteCompanies(ids: string[], actor: Actor): Promise<number> {
    const db = client();
    const targets = await db.company.findMany({ where: { id: { in: ids }, deletedAt: null } });
    if (targets.length === 0) return 0;

    const result = await db.company.updateMany({
      where: { id: { in: targets.map((t: any) => t.id) } },
      data: { deletedAt: new Date() },
    });

    for (const target of targets) {
      await prismaRepo.recordAudit({
        action: 'DELETE',
        entity: 'company',
        entityId: target.id,
        entityLabel: target.name,
        actorId: actor.id,
        actorName: actor.name,
        summary: `${actor.name} deleted company ${target.name}`,
      });
    }

    return result.count;
  },

  async listRoutes(productId: string): Promise<SynthesisRouteView[]> {
    const rows = await client().synthesisRoute.findMany({
      where: { productId, deletedAt: null },
      include: ROUTE_INCLUDE,
      orderBy: [{ isPreferred: 'desc' }, { name: 'asc' }],
    });
    return rows.map(mapRouteView);
  },

  async getWhereUsed(productId: string, opts): Promise<WhereUsedEntry[]> {
    const traced = traceConsumers(productId, await loadEdges(), opts?.maxDepth ?? 6);
    if (!traced.length) return [];
    const ids = [...new Set(traced.flatMap((c) => [c.productId, ...c.via]))];
    const rows = await client().product.findMany({ where: { id: { in: ids } }, include: SUMMARY_INCLUDE });
    const byId = new Map(rows.map((r: any) => [r.id, r]));

    return traced.flatMap((consumer) => {
      const product: any = byId.get(consumer.productId);
      if (!product || product.deletedAt) return [];
      return [
        {
          product: mapSummary(product),
          depth: consumer.depth,
          routeId: consumer.routeId,
          routeName: consumer.routeName,
          role: consumer.role,
          via: consumer.via.flatMap((id) => {
            const step: any = byId.get(id);
            return step ? [{ id: step.id, name: step.name, slug: step.slug }] : [];
          }),
        },
      ];
    });
  },

  async createRoute(productId: string, input: RouteWriteInput, actor: Actor): Promise<SynthesisRouteView | null> {
    const db = client();
    const product = await db.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) return null;

    const names = await activeNames(input.inputs.map((i) => i.productId));
    assertRouteWritable({ outputId: productId, input, edges: await loadEdges(), activeProductName: (id) => names.get(id) });

    if (input.isPreferred) {
      await db.synthesisRoute.updateMany({ where: { productId, deletedAt: null }, data: { isPreferred: false } });
    }
    const created = await db.synthesisRoute.create({
      data: {
        productId,
        name: input.name,
        isPreferred: input.isPreferred,
        reviewStatus: REVIEW_TO_DB[input.reviewStatus],
        notes: input.notes || null,
        inputs: { create: toInputRows(input.inputs) },
      },
      include: ROUTE_INCLUDE,
    });

    await prismaRepo.recordAudit({
      action: 'CREATE',
      entity: 'product',
      entityId: productId,
      entityLabel: product.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} added synthesis route “${input.name}” to ${product.name}`,
    });
    return mapRouteView(created);
  },

  async updateRoute(routeId: string, input: RouteWriteInput, actor: Actor): Promise<SynthesisRouteView | null> {
    const db = client();
    const existing = await db.synthesisRoute.findFirst({
      where: { id: routeId, deletedAt: null },
      include: { ...ROUTE_INCLUDE, product: true },
    });
    if (!existing || existing.product?.deletedAt) return null;

    const names = await activeNames(input.inputs.map((i) => i.productId));
    assertRouteWritable({
      outputId: existing.productId,
      input,
      edges: await loadEdges(routeId),
      activeProductName: (id) => names.get(id),
    });

    // Old inputs' names come from the include; new ones from the lookup above.
    const oldNames = new Map<string, string>(
      existing.inputs.filter((i: any) => i.product).map((i: any) => [i.product.id, i.product.name]),
    );
    const changes = routeChanges(mapRoute(existing), input, (id) => names.get(id) ?? oldNames.get(id));

    if (input.isPreferred) {
      await db.synthesisRoute.updateMany({
        where: { productId: existing.productId, deletedAt: null, id: { not: routeId } },
        data: { isPreferred: false },
      });
    }
    const updated = await db.synthesisRoute.update({
      where: { id: routeId },
      data: {
        name: input.name,
        isPreferred: input.isPreferred,
        reviewStatus: REVIEW_TO_DB[input.reviewStatus],
        notes: input.notes || null,
        // Replace wholesale in one statement — no window with a half-written route.
        inputs: { deleteMany: {}, create: toInputRows(input.inputs) },
      },
      include: ROUTE_INCLUDE,
    });

    await prismaRepo.recordAudit({
      action: 'UPDATE',
      entity: 'product',
      entityId: existing.productId,
      entityLabel: existing.product.name,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} updated synthesis route “${input.name}” on ${existing.product.name}`,
      changes,
    });
    return mapRouteView(updated);
  },

  async deleteRoute(routeId: string, actor: Actor): Promise<boolean> {
    const db = client();
    const existing = await db.synthesisRoute.findFirst({ where: { id: routeId, deletedAt: null }, include: { product: true } });
    if (!existing) return false;
    await db.synthesisRoute.update({ where: { id: routeId }, data: { deletedAt: new Date(), isPreferred: false } });

    await prismaRepo.recordAudit({
      action: 'DELETE',
      entity: 'product',
      entityId: existing.productId,
      entityLabel: existing.product?.name ?? 'Unknown product',
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} removed synthesis route “${existing.name}” from ${existing.product?.name ?? 'a product'}`,
    });
    return true;
  },

  async structureSearch(query: StructureQuery): Promise<StructureSearchResult> {
    // Facet filters run in SQL via listProducts; RDKit ranks the filtered set.
    return runStructureSearch(query, (q) => prismaRepo.listProducts(q));
  },

  async search(q: string, opts): Promise<SearchHit[]> {
    const query = q.trim();
    if (!query) return [];

    const limit = opts?.limit ?? 20;
    const types = opts?.types ?? (['product', 'company', 'application', 'location'] as SearchHit['type'][]);
    const db = client();
    const hits: SearchHit[] = [];

    if (types.includes('product')) {
      const rows = await db.product.findMany({ where: { deletedAt: null }, include: PRODUCT_INCLUDE });
      for (const row of rows.map(mapProduct)) {
        const m = bestMatch(query, [
          { name: 'Product name', value: row.name, weight: 1 },
          { name: 'CAS number', value: row.casNumber, weight: 1, cas: true },
          { name: 'Synonym', value: row.synonyms.join(' | '), weight: 0.85 },
          { name: 'Formula', value: row.molecularFormula, weight: 0.7 },
          { name: 'Application', value: row.applicationName, weight: 0.5 },
        ]);
        if (m.score > 0) {
          hits.push({
            type: 'product',
            id: row.id,
            slug: row.slug,
            title: row.name,
            subtitle: `${row.casNumber} · ${row.applicationName}`,
            matchedField: m.field,
            matchedValue: m.value,
            score: m.score * 1.1,
            href: `/products/${row.slug}`,
          });
        }
      }
    }

    if (types.includes('company')) {
      const rows = await db.company.findMany({ where: { deletedAt: null }, include: COMPANY_INCLUDE });
      for (const row of rows.map(mapCompany)) {
        const m = bestMatch(query, [
          { name: 'Company name', value: row.name, weight: 1 },
          { name: 'Location', value: row.locationName, weight: 0.7 },
          { name: 'Strength', value: row.strength, weight: 0.6 },
        ]);
        if (m.score > 0) {
          hits.push({
            type: 'company',
            id: row.id,
            slug: row.slug,
            title: row.name,
            subtitle: `${row.locationName} · ${row.chemicalStaff} chemical staff`,
            matchedField: m.field,
            matchedValue: m.value,
            score: m.score,
            href: `/companies/${row.slug}`,
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

  async dashboard(): Promise<DashboardMetrics> {
    const db = client();

    const [products, companies, links, activity] = await Promise.all([
      db.product.findMany({ where: { deletedAt: null }, include: PRODUCT_INCLUDE }),
      db.company.findMany({ where: { deletedAt: null }, include: COMPANY_INCLUDE }),
      db.productCompany.findMany(),
      db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);

    const productRows = products.map(mapProductRow);
    const companyRows = companies.map(mapCompanyRow);

    const tally = <T>(items: T[], key: (t: T) => string | undefined) => {
      const map = new Map<string, number>();
      for (const item of items) {
        const k = key(item);
        if (k) map.set(k, (map.get(k) ?? 0) + 1);
      }
      return map;
    };

    const byApplicationMap = tally(productRows, (p) => p.applicationName);
    const byStatusMap = tally(productRows, (p) => p.status);
    const byCityMap = tally(companyRows, (c) => c.locationName);
    const byCategoryMap = tally(productRows, (p) => p.categoryName);
    const linksByCompany = tally(links, (l: any) => l.companyId);

    const buckets = (map: Map<string, number>): CountBucket[] =>
      Array.from(map, ([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value);

    const equipmentRows = await db.companyEquipment.findMany({
      where: { available: true },
      include: { equipment: true },
    });
    const equipmentAvailability = EQUIPMENT_MASTER.map((eq) => ({
      key: eq.key,
      label: eq.name,
      value: equipmentRows.filter((e: any) => e.equipment?.key === eq.key).length,
    })).sort((a, b) => b.value - a.value);

    const now = new Date();
    const monthlyAdditions: Array<{ month: string; products: number; companies: number }> = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthlyAdditions.push({
        month: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
        products: productRows.filter((p) => p.createdAt.startsWith(key)).length,
        companies: companyRows.filter((c) => c.createdAt.startsWith(key)).length,
      });
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

    return {
      totalProducts: productRows.length,
      commercialProducts: byStatusMap.get('Commercial') ?? 0,
      developmentProducts: byStatusMap.get('Development') ?? 0,
      pilotProducts: byStatusMap.get('Pilot') ?? 0,
      totalCompanies: companyRows.length,
      totalLocations: byCityMap.size,
      totalApplications: byApplicationMap.size,
      totalLinks: links.length,
      avgCompaniesPerProduct: productRows.length ? Number((links.length / productRows.length).toFixed(1)) : 0,
      productsAddedLast30d: productRows.filter((p) => p.createdAt >= thirtyDaysAgo).length,
      byApplication: buckets(byApplicationMap),
      byStatus: buckets(byStatusMap),
      byCity: buckets(byCityMap),
      byCategory: buckets(byCategoryMap),
      topCompanies: companyRows
        .map((c) => ({ key: c.id, label: c.name, value: linksByCompany.get(c.id) ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      equipmentAvailability,
      monthlyAdditions,
      recentProducts: [...productRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
      recentActivity: activity.map(mapAudit),
    };
  },

  async equipmentCoverage() {
    const db = client();
    const [total, rows] = await Promise.all([
      db.company.count({ where: { deletedAt: null } }),
      db.companyEquipment.findMany({ where: { available: true }, include: { equipment: true } }),
    ]);

    const denominator = total || 1;
    return EQUIPMENT_MASTER.map((eq) => {
      const count = rows.filter((r: any) => r.equipment?.key === eq.key).length;
      return { key: eq.key, name: eq.name, companies: count, pct: Math.round((count / denominator) * 100) };
    }).sort((a, b) => b.companies - a.companies);
  },

  async listAuditLogs(limit = 50): Promise<AuditLog[]> {
    const rows = await client().auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    return rows.map(mapAudit);
  },

  async listEntityAuditLogs(entityId: string, limit = 25): Promise<AuditLog[]> {
    const rows = await client().auditLog.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapAudit);
  },

  async listDocuments(scope): Promise<DocumentRecord[]> {
    const where = scope.productId ? { productId: scope.productId } : { companyId: scope.companyId };
    const rows = await client().document.findMany({
      where,
      include: { uploadedBy: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row: any) => ({
      id: row.id,
      productId: row.productId ?? undefined,
      companyId: row.companyId ?? undefined,
      name: row.name,
      kind: row.kind,
      sizeKb: row.sizeKb,
      version: row.version,
      uploadedById: row.uploadedById ?? '',
      uploadedByName: row.uploadedBy?.name ?? 'Unknown',
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async listUsers(): Promise<User[]> {
    const rows = await client().user.findMany({
      where: { deletedAt: null },
      include: { role: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(mapUser);
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const row = await client().user.findFirst({
      where: { email: email.trim().toLowerCase(), deletedAt: null },
      include: { role: true },
    });
    return row ? mapUser(row) : null;
  },

  async recordAudit(entry): Promise<AuditLog> {
    const row = await client().auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        entityLabel: entry.entityLabel,
        actorId: entry.actorId === 'system' ? null : entry.actorId,
        actorName: entry.actorName,
        summary: entry.summary,
        changes: entry.changes ?? undefined,
      },
    });
    return mapAudit(row);
  },

  async allCompanies(): Promise<Company[]> {
    const rows = await client().company.findMany({
      where: { deletedAt: null },
      include: COMPANY_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return rows.map(mapCompany);
  },

  async allProducts(): Promise<Product[]> {
    const rows = await client().product.findMany({
      where: { deletedAt: null },
      include: PRODUCT_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return rows.map(mapProduct);
  },
};
