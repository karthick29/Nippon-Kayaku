import type { NextRequest } from 'next/server';
import { created, fail, ok, readJson, route } from '@/server/api';
import { currentActor, requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';
import { parseRouteRequest } from '@/server/route-request';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/products/:idOrSlug/routes — routes that make this product, preferred first. */
export const GET = route(async (_request: NextRequest, { params }: Context) => {
  await requirePermission('product:read');
  const product = await repo.getProduct((await params).id);
  if (!product) return fail('Product not found', 404);
  return ok(await repo.listRoutes(product.id));
});

/**
 * POST /api/products/:idOrSlug/routes — add a synthesis route.
 * 422 on a bad field, an input that isn't an active catalogue product,
 * or a route that would create a loop (`inputs.N.productId`).
 */
export const POST = route(async (request: NextRequest, { params }: Context) => {
  await requirePermission('product:update');
  const product = await repo.getProduct((await params).id);
  if (!product) return fail('Product not found', 404);

  const input = await parseRouteRequest(await readJson(request));
  const createdRoute = await repo.createRoute(product.id, input, await currentActor());
  return createdRoute ? created(createdRoute) : fail('Product not found', 404);
});
