import type { NextRequest } from 'next/server';
import { fail, ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/products/:idOrSlug/companies — the full capability matrix. */
export const GET = route(async (_request: NextRequest, { params }: Context) => {
  await requirePermission('product:read');
  const { id } = await params;

  const product = await repo.getProduct(id);
  if (!product) return fail('Product not found', 404);

  const rows = await repo.getProductCompanies(product.id);
  return ok(rows);
});
