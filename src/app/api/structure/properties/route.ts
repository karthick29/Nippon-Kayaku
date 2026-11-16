import type { NextRequest } from 'next/server';
import { fail, ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { MAX_STRUCTURE_LENGTH, structureProperties } from '@/server/chem/rdkit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/structure/properties?smiles=
 * Calculated properties of a structure — formula, masses, elemental analysis,
 * cLogP, TPSA and counts. Backs the live analysis strip in the structure
 * editor. Same 422 envelope as /depict.
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');

  const smiles = (request.nextUrl.searchParams.get('smiles') ?? '').trim();
  if (!smiles || smiles.length > MAX_STRUCTURE_LENGTH) {
    return fail('Validation failed', 422, { fields: { smiles: `Enter a SMILES string up to ${MAX_STRUCTURE_LENGTH} characters` } });
  }
  const properties = await structureProperties(smiles);
  if (!properties) return fail('Validation failed', 422, { fields: { smiles: 'Not a valid structure' } });
  return ok(properties);
});
