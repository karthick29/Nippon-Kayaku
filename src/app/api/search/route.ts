import type { NextRequest } from 'next/server';
import { ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';
import type { SearchHit } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_TYPES: SearchHit['type'][] = ['product', 'company', 'application', 'location'];

/**
 * GET /api/search?q=&limit=&types=product,company
 * Unified autocomplete across products, companies, applications and
 * locations. Backs both the ⌘K palette and the Search Chemicals page.
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');

  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').slice(0, 200);
  const limit = Math.min(50, Number.parseInt(params.get('limit') ?? '20', 10) || 20);

  const requested = params.get('types')?.split(',').filter(Boolean) ?? [];
  const types = requested.filter((t): t is SearchHit['type'] => VALID_TYPES.includes(t as SearchHit['type']));

  const hits = await repo.search(q, { limit, types: types.length ? types : undefined });
  return ok(hits);
});
