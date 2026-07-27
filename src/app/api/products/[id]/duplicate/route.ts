import type { NextRequest } from 'next/server';
import { created, fail, route } from '@/server/api';
import { currentActor, requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** POST /api/products/:id/duplicate — copies the product and its links. */
export const POST = route(async (_request: NextRequest, { params }: Context) => {
  await requirePermission('product:create');
  const { id } = await params;
  const actor = await currentActor();

  const copy = await repo.duplicateProduct(id, actor);
  return copy ? created(copy) : fail('Product not found', 404);
});
