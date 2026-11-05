import type { NextRequest } from 'next/server';
import { fail, ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/products/:idOrSlug/where-used?depth=1..10
 * Products made from this one, directly (depth 1) or via intermediates,
 * each at its shortest chain with the intermediates listed in `via`.
 */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  await requirePermission('product:read');
  const product = await repo.getProduct((await params).id);
  if (!product) return fail('Product not found', 404);

  const raw = Number.parseInt(request.nextUrl.searchParams.get('depth') ?? '6', 10);
  const maxDepth = Number.isFinite(raw) ? Math.min(10, Math.max(1, raw)) : 6;
  return ok(await repo.getWhereUsed(product.id, { maxDepth }));
});
