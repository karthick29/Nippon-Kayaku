import type { NextRequest } from 'next/server';
import { fail, ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { depictStructure, describeStructure, MAX_STRUCTURE_LENGTH } from '@/server/chem/rdkit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/structure/depict?smiles=&w=&h=
 * Canonicalises a SMILES string and returns its depiction, formula and
 * identity. Backs the live structure preview in the product forms.
 * Unparseable input is a 422 on the `smiles` field, same envelope as Zod.
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');

  const params = request.nextUrl.searchParams;
  const smiles = (params.get('smiles') ?? '').trim();
  if (!smiles || smiles.length > MAX_STRUCTURE_LENGTH) {
    return fail('Validation failed', 422, { fields: { smiles: `Enter a SMILES string up to ${MAX_STRUCTURE_LENGTH} characters` } });
  }

  const clamp = (v: string | null, fallback: number) => Math.min(600, Math.max(80, Number(v) || fallback));
  const [info, svg] = await Promise.all([
    describeStructure(smiles),
    depictStructure(smiles, { width: clamp(params.get('w'), 240), height: clamp(params.get('h'), 180) }),
  ]);

  if (!info || !svg) {
    return fail('Validation failed', 422, { fields: { smiles: 'Not a valid structure' } });
  }
  return ok({ ...info, svg });
});
