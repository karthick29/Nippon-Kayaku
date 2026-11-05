import type { NextRequest } from 'next/server';
import { fail, ok, readJson, route } from '@/server/api';
import { currentActor, requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';
import { resolveStructureInput } from '@/server/chem/structure-input';
import { productUpdateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/products/:idOrSlug */
export const GET = route(async (_request: NextRequest, { params }: Context) => {
  await requirePermission('product:read');
  const { id } = await params;
  const product = await repo.getProduct(id);
  return product ? ok(product) : fail('Product not found', 404);
});

/** PATCH /api/products/:id */
export const PATCH = route(async (request: NextRequest, { params }: Context) => {
  await requirePermission('product:update');
  const { id } = await params;
  const body = productUpdateSchema.parse(await readJson(request));
  const structure = await resolveStructureInput(body.smiles);
  const actor = await currentActor();

  const product = await repo.updateProduct(
    id,
    {
      ...body,
      ...structure,
      molecularFormula: body.molecularFormula || undefined,
      description: body.description || undefined,
    },
    actor,
  );

  return product ? ok(product) : fail('Product not found', 404);
});

/** DELETE /api/products/:id — soft delete, recoverable from audit. */
export const DELETE = route(async (_request: NextRequest, { params }: Context) => {
  await requirePermission('product:delete');
  const { id } = await params;
  const actor = await currentActor();
  const count = await repo.deleteProducts([id], actor);
  return count ? ok({ deleted: count }) : fail('Product not found', 404);
});
