import type { NextRequest } from 'next/server';
import { fail, ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { checkStructure, MAX_STRUCTURE_LENGTH } from '@/server/chem/rdkit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/structure/check?structure=&query=1
 * Confirms that what the structure editor wrote is readable before the editor
 * closes, and returns it in stored form: canonical SMILES, or — with `query=1`,
 * for substructure search — a SMARTS pattern as written. Same 422 envelope as
 * /depict, on the `structure` field.
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');

  const params = request.nextUrl.searchParams;
  const structure = (params.get('structure') ?? '').trim();
  if (!structure || structure.length > MAX_STRUCTURE_LENGTH) {
    return fail('Validation failed', 422, { fields: { structure: `Enter a structure up to ${MAX_STRUCTURE_LENGTH} characters` } });
  }
  const checked = await checkStructure(structure, params.get('query') === '1');
  if (!checked) return fail('Validation failed', 422, { fields: { structure: 'Not a valid structure' } });
  return ok(checked);
});
