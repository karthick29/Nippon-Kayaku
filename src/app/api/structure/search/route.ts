import type { NextRequest } from 'next/server';
import { fail, ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';
import { parseStructureQuery } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/structure/search?mode=substructure|similarity|exact&q=&threshold=&limit=
 * Accepts the same facet filters as /api/products (status, application,
 * category, company, location, equipment). Hits carry matched atom and
 * bond indices for highlighting; the query is a 422 on `q` if it doesn't
 * parse for its mode (SMARTS is substructure-only).
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');
  const query = parseStructureQuery(request.nextUrl.searchParams);
  if (!query) {
    return fail('Validation failed', 422, {
      fields: { q: 'Provide mode=substructure|similarity|exact and a structure in q' },
    });
  }
  return ok(await repo.structureSearch(query));
});
