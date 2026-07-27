import type { NextRequest } from 'next/server';
import { created, ok, readJson, route } from '@/server/api';
import { currentActor, requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';
import { parseProductQuery, productCreateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/products — filtered, sorted, paginated product list. */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');
  const query = parseProductQuery(request.nextUrl.searchParams);
  const result = await repo.listProducts(query);
  return ok(result);
});

/** POST /api/products — create a product with optional company links. */
export const POST = route(async (request: NextRequest) => {
  await requirePermission('product:create');
  const body = productCreateSchema.parse(await readJson(request));
  const actor = await currentActor();

  const product = await repo.createProduct(
    {
      ...body,
      molecularFormula: body.molecularFormula || undefined,
      description: body.description || undefined,
      companies: body.companies?.map((c) => ({
        companyId: c.companyId,
        productCodes: c.productCodes,
        strength: c.strength || undefined,
        presentation: c.presentation || undefined,
        remarks: c.remarks || undefined,
      })),
    },
    actor,
  );

  return created(product);
});
