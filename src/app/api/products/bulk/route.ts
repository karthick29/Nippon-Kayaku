import type { NextRequest } from 'next/server';
import { ok, readJson, route } from '@/server/api';
import { currentActor, requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';
import { bulkEditSchema, bulkIdsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** POST /api/products/bulk — bulk edit selected products. */
export const POST = route(async (request: NextRequest) => {
  await requirePermission('product:update');
  const { ids, patch } = bulkEditSchema.parse(await readJson(request));
  const actor = await currentActor();

  let updated = 0;
  for (const id of ids) {
    const result = await repo.updateProduct(id, patch, actor);
    if (result) updated += 1;
  }

  return ok({ updated });
});

/** DELETE /api/products/bulk — soft-delete selected products. */
export const DELETE = route(async (request: NextRequest) => {
  await requirePermission('product:delete');
  const { ids } = bulkIdsSchema.parse(await readJson(request));
  const actor = await currentActor();
  const deleted = await repo.deleteProducts(ids, actor);
  return ok({ deleted });
});
