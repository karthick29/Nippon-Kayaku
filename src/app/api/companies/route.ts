import type { NextRequest } from 'next/server';
import { created, ok, readJson, route } from '@/server/api';
import { currentActor, requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';
import { companySchema, parseCompanyQuery } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/companies — filtered, sorted, paginated company list. */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('company:read');
  const query = parseCompanyQuery(request.nextUrl.searchParams);
  return ok(await repo.listCompanies(query));
});

/** POST /api/companies */
export const POST = route(async (request: NextRequest) => {
  await requirePermission('company:create');
  const body = companySchema.parse(await readJson(request));
  const actor = await currentActor();

  const company = await repo.createCompany(
    {
      ...body,
      capital: body.capital || undefined,
      strength: body.strength || undefined,
      presentation: body.presentation || undefined,
      remarks: body.remarks || undefined,
      website: body.website || undefined,
      contactEmail: body.contactEmail || undefined,
    },
    actor,
  );

  return created(company);
});
