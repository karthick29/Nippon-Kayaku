import type { NextRequest } from 'next/server';
import { fail, ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { externalNameLookupEnabled, lookupOpsin, matchCatalogue, type NameMatch } from '@/server/chem/name-lookup';
import { molfileFor } from '@/server/chem/rdkit';
import { repo } from '@/server/repo';

export const dynamic = 'force-dynamic';

export interface NameLookupResult {
  /** The structure to load, when the name or CAS number identified exactly one. */
  match: (NameMatch & { molfile: string }) | null;
  /** Close catalogue products to offer instead — each is looked up again by its exact name. */
  suggestions: Array<{ name: string; casNumber: string }>;
  /** Whether names outside the catalogue can be resolved in this deployment. */
  externalLookup: boolean;
}

/**
 * GET /api/structure/lookup?q=
 * Name or CAS number → structure, for the structure editor. Catalogue first;
 * OPSIN only where the deployment enabled it (see server/chem/name-lookup).
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2 || q.length > 200) {
    return fail('Validation failed', 422, { fields: { q: 'Enter a name or CAS number' } });
  }

  const externalLookup = externalNameLookupEnabled();
  const exact = matchCatalogue(await repo.allProducts(), q);
  let found: NameMatch | null =
    exact.length === 1
      ? { name: exact[0]!.name, casNumber: exact[0]!.casNumber, smiles: exact[0]!.smiles!, source: 'catalogue' }
      : null;

  let suggestions: NameLookupResult['suggestions'] = [];
  if (!found) {
    if (exact.length > 1) {
      suggestions = exact.map((p) => ({ name: p.name, casNumber: p.casNumber }));
    } else {
      found = await lookupOpsin(q);
      if (!found) {
        const hits = await repo.search(q, { limit: 6, types: ['product'] });
        const withStructure = new Map((await repo.allProducts()).filter((p) => p.smiles).map((p) => [p.id, p]));
        suggestions = hits.flatMap((hit) => {
          const product = withStructure.get(hit.id);
          return product ? [{ name: product.name, casNumber: product.casNumber }] : [];
        });
      }
    }
  }

  const molfile = found ? await molfileFor(found.smiles) : null;
  return ok<NameLookupResult>({ match: found && molfile ? { ...found, molfile } : null, suggestions, externalLookup });
});
