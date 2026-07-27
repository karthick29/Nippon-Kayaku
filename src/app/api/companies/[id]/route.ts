import type { NextRequest } from 'next/server';
import { fail, ok, readJson, route } from '@/server/api';
import { currentActor, requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';
import { companySchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/companies/:idOrSlug — profile, equipment and product list. */
export const GET = route(async (_request: NextRequest, { params }: Context) => {
  await requirePermission('company:read');
  const { id } = await params;

  const company = await repo.getCompany(id);
  if (!company) return fail('Company not found', 404);

  const [equipment, products] = await Promise.all([
    repo.getCompanyEquipment(company.id),
    repo.getCompanyProducts(company.id),
  ]);

  return ok({ company, equipment, products });
});

/** PATCH /api/companies/:id */
export const PATCH = route(async (request: NextRequest, { params }: Context) => {
  await requirePermission('company:update');
  const { id } = await params;
  const body = companySchema.partial().parse(await readJson(request));
  const actor = await currentActor();

  const company = await repo.updateCompany(id, body, actor);
  return company ? ok(company) : fail('Company not found', 404);
});

/** DELETE /api/companies/:id — soft delete. */
export const DELETE = route(async (_request: NextRequest, { params }: Context) => {
  await requirePermission('company:delete');
  const { id } = await params;
  const actor = await currentActor();
  const count = await repo.deleteCompanies([id], actor);
  return count ? ok({ deleted: count }) : fail('Company not found', 404);
});
