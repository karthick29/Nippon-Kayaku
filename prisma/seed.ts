/* ════════════════════════════════════════════════════════════════════
   Seeds PostgreSQL from exactly the same deterministic corpus that the
   in-memory adapter serves, so `ASTRA_DATA_SOURCE=prisma` produces an
   identical application to the zero-setup default.

   Run:  npm run db:generate && npm run db:push && npm run db:seed
   ════════════════════════════════════════════════════════════════════ */

import { PrismaClient } from '@prisma/client';
import { buildDataset } from '../src/data/dataset';
import { APPLICATIONS, CATEGORIES, EQUIPMENT_MASTER, LOCATIONS } from '../src/data/masters';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '../src/server/rbac';
import type { Permission, ProductStatus, Role } from '../src/lib/types';

const prisma = new PrismaClient();

/**
 * Mirrors the ProductStatus enum in schema.prisma. Declared locally
 * rather than imported from @prisma/client so `npm run typecheck` works
 * before `prisma generate` has ever been run.
 */
type PrismaProductStatus = 'COMMERCIAL' | 'DEVELOPMENT' | 'PILOT' | 'DISCONTINUED';

const STATUS_MAP: Record<ProductStatus, PrismaProductStatus> = {
  Commercial: 'COMMERCIAL',
  Development: 'DEVELOPMENT',
  Pilot: 'PILOT',
  Discontinued: 'DISCONTINUED',
};

const ROLE_RANK: Record<Role, number> = { VIEWER: 10, ANALYST: 20, MANAGER: 30, ADMIN: 40 };

async function main() {
  console.log('› Clearing existing rows…');
  // Order matters: children before parents.
  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.savedSearch.deleteMany(),
    prisma.document.deleteMany(),
    prisma.productVersion.deleteMany(),
    prisma.productCompany.deleteMany(),
    prisma.companyEquipment.deleteMany(),
    prisma.product.deleteMany(),
    prisma.company.deleteMany(),
    prisma.equipmentMaster.deleteMany(),
    prisma.companyLocation.deleteMany(),
    prisma.productCategory.deleteMany(),
    prisma.application.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
  ]);

  /* ── Roles & permissions ──────────────────────────────────────── */
  console.log('› Seeding roles and permissions…');
  const allPermissions = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat())) as Permission[];

  const permissionRows = await Promise.all(
    allPermissions.map((key) => {
      const [resource, action] = key.split(':');
      return prisma.permission.create({
        data: { key, resource: resource!, action: action!, description: `${action} ${resource}` },
      });
    }),
  );
  const permissionByKey = new Map(permissionRows.map((p) => [p.key, p.id]));

  const roleRows = await Promise.all(
    (Object.keys(ROLE_PERMISSIONS) as Role[]).map((key) =>
      prisma.role.create({
        data: {
          key,
          name: ROLE_LABELS[key],
          description: ROLE_DESCRIPTIONS[key],
          rank: ROLE_RANK[key],
          permissions: {
            create: ROLE_PERMISSIONS[key].map((p) => ({ permissionId: permissionByKey.get(p)! })),
          },
        },
      }),
    ),
  );
  const roleByKey = new Map(roleRows.map((r) => [r.key, r.id]));

  /* ── Master data ──────────────────────────────────────────────── */
  console.log('› Seeding master data…');
  const applicationRows = await Promise.all(
    APPLICATIONS.map((a) =>
      prisma.application.create({
        data: {
          name: a.name,
          slug: a.slug,
          description: a.description,
          colorKey: a.colorKey,
          sortOrder: a.sortOrder,
          active: a.active,
        },
      }),
    ),
  );
  const applicationBySeedId = new Map(APPLICATIONS.map((a, i) => [a.id, applicationRows[i]!.id]));

  const categoryRows = await Promise.all(
    CATEGORIES.map((c) =>
      prisma.productCategory.create({
        data: { name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder, active: c.active },
      }),
    ),
  );
  const categoryBySeedId = new Map(CATEGORIES.map((c, i) => [c.id, categoryRows[i]!.id]));

  const locationRows = await Promise.all(
    LOCATIONS.map((l) =>
      prisma.companyLocation.create({
        data: {
          name: l.name,
          slug: l.slug,
          state: l.state,
          country: l.country,
          region: l.region,
          sortOrder: l.sortOrder,
          active: l.active,
        },
      }),
    ),
  );
  const locationBySeedId = new Map(LOCATIONS.map((l, i) => [l.id, locationRows[i]!.id]));

  const equipmentRows = await Promise.all(
    EQUIPMENT_MASTER.map((e) =>
      prisma.equipmentMaster.create({
        data: { key: e.key, name: e.name, group: e.group, valueType: e.valueType, unit: e.unit, sortOrder: e.sortOrder },
      }),
    ),
  );
  const equipmentByKey = new Map(equipmentRows.map((e) => [e.key, e.id]));

  /* ── Corpus ───────────────────────────────────────────────────── */
  const data = buildDataset();

  console.log(`› Seeding ${data.users.length} users…`);
  const userRows = await Promise.all(
    data.users.map((u) =>
      prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          title: u.title,
          roleId: roleByKey.get(u.role)!,
          active: u.active,
          lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt) : null,
          createdAt: new Date(u.createdAt),
          // No password hashes in the demo corpus — see src/server/auth.ts.
          passwordHash: null,
        },
      }),
    ),
  );
  const userBySeedId = new Map(data.users.map((u, i) => [u.id, userRows[i]!.id]));

  console.log(`› Seeding ${data.companies.length} companies…`);
  const companyRows = await Promise.all(
    data.companies.map((c) =>
      prisma.company.create({
        data: {
          name: c.name,
          slug: c.slug,
          locationId: locationBySeedId.get(c.locationId)!,
          chemicalStaff: c.chemicalStaff,
          phdCount: c.phdCount,
          established: c.established,
          capital: c.capital,
          strength: c.strength,
          presentation: c.presentation,
          remarks: c.remarks,
          website: c.website,
          contactEmail: c.contactEmail,
          createdAt: new Date(c.createdAt),
        },
      }),
    ),
  );
  const companyBySeedId = new Map(data.companies.map((c, i) => [c.id, companyRows[i]!.id]));

  console.log(`› Seeding ${data.equipment.length} company equipment rows…`);
  await prisma.companyEquipment.createMany({
    data: data.equipment.map((e) => ({
      companyId: companyBySeedId.get(e.companyId)!,
      equipmentId: equipmentByKey.get(e.equipmentKey)!,
      available: e.available,
      count: e.count ?? null,
      specification: e.specification ?? null,
      capacity: e.capacity ?? null,
      remarks: e.remarks ?? null,
    })),
  });

  console.log(`› Seeding ${data.products.length} products…`);
  const productRows = await Promise.all(
    data.products.map((p) =>
      prisma.product.create({
        data: {
          name: p.name,
          slug: p.slug,
          casNumber: p.casNumber,
          molecularFormula: p.molecularFormula,
          molecularWeight: p.molecularWeight ?? null,
          applicationId: applicationBySeedId.get(p.applicationId)!,
          categoryId: categoryBySeedId.get(p.categoryId)!,
          status: STATUS_MAP[p.status],
          description: p.description,
          synonyms: p.synonyms,
          createdAt: new Date(p.createdAt),
        },
      }),
    ),
  );
  const productBySeedId = new Map(data.products.map((p, i) => [p.id, productRows[i]!.id]));

  console.log(`› Seeding ${data.links.length} product ⇄ company links…`);
  await prisma.productCompany.createMany({
    data: data.links.map((l) => ({
      productId: productBySeedId.get(l.productId)!,
      companyId: companyBySeedId.get(l.companyId)!,
      productCodes: l.productCodes,
      strength: l.strength ?? null,
      presentation: l.presentation ?? null,
      capital: l.capital ?? null,
      remarks: l.remarks ?? null,
      status: STATUS_MAP[l.status],
      createdAt: new Date(l.createdAt),
    })),
    skipDuplicates: true,
  });

  console.log(`› Seeding ${data.documents.length} documents…`);
  await prisma.document.createMany({
    data: data.documents.map((d) => ({
      productId: d.productId ? productBySeedId.get(d.productId)! : null,
      companyId: d.companyId ? companyBySeedId.get(d.companyId)! : null,
      name: d.name,
      kind: d.kind,
      sizeKb: d.sizeKb,
      version: d.version,
      uploadedById: userBySeedId.get(d.uploadedById) ?? null,
      createdAt: new Date(d.createdAt),
    })),
  });

  console.log(`› Seeding ${data.auditLogs.length} audit entries…`);
  await prisma.auditLog.createMany({
    data: data.auditLogs.map((a) => ({
      action: a.action,
      entity: a.entity,
      entityId:
        a.entity === 'product'
          ? (productBySeedId.get(a.entityId) ?? a.entityId)
          : a.entity === 'company'
            ? (companyBySeedId.get(a.entityId) ?? a.entityId)
            : a.entityId,
      entityLabel: a.entityLabel,
      actorId: userBySeedId.get(a.actorId) ?? null,
      actorName: a.actorName,
      summary: a.summary,
      changes: a.changes ? JSON.parse(JSON.stringify(a.changes)) : undefined,
      createdAt: new Date(a.createdAt),
    })),
  });

  console.log('\n✓ Seed complete');
  console.log(`  ${applicationRows.length} applications · ${categoryRows.length} categories · ${locationRows.length} locations`);
  console.log(`  ${equipmentRows.length} equipment types · ${companyRows.length} companies · ${productRows.length} products`);
  console.log(`  ${data.links.length} product-company links · ${userRows.length} users · ${roleRows.length} roles`);
}

main()
  .catch((error) => {
    console.error('✗ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
