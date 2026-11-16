import type { NextRequest } from 'next/server';
import { fail, ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { MAX_STRUCTURE_LENGTH, molfileFor } from '@/server/chem/rdkit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/structure/molfile?smiles=
 * A 2D molfile for loading a structure into the editor. Loading a molfile
 * rather than a SMILES string keeps stereochemistry and unspecified double
 * bonds exactly as stored — see `molfileFor`. Same 422 envelope as /depict.
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');

  const smiles = (request.nextUrl.searchParams.get('smiles') ?? '').trim();
  if (!smiles || smiles.length > MAX_STRUCTURE_LENGTH) {
    return fail('Validation failed', 422, { fields: { smiles: `Enter a SMILES string up to ${MAX_STRUCTURE_LENGTH} characters` } });
  }
  const molfile = await molfileFor(smiles);
  if (!molfile) return fail('Validation failed', 422, { fields: { smiles: 'Not a valid structure' } });
  return ok({ molfile });
});
