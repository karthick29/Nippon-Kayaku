import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Hexagon, SearchX, TriangleAlert } from 'lucide-react';
import { ZodError } from 'zod';
import { StructureImage } from '@/components/chem/StructureImage';
import { PageHeader, Stack } from '@/components/page/PageHeader';
import { ProductResultCard } from '@/components/search/ProductResultCard';
import { Button, EmptyState, Skeleton } from '@/components/vbds';
import { APPLICATIONS, CATEGORIES, EQUIPMENT_MASTER, LOCATIONS } from '@/data/masters';
import { PRODUCT_STATUSES, type StructureHit, type StructureQuery, type StructureSearchResult } from '@/lib/types';
import { parseProductQuery, parseStructureQuery } from '@/lib/validation';
import { repo } from '@/server/repo';
import { SearchControls } from './SearchControls';

export const metadata: Metadata = { title: 'Search Chemicals' };
export const dynamic = 'force-dynamic';

const POPULAR = [
  'Benzyl chloroformate',
  '501-53-1',
  'Palladium',
  'Boc anhydride',
  'Flow chemistry',
  'Epoxy',
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toURLSearchParams(input: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams;
  const params = toURLSearchParams(resolved);

  return (
    <div className="astra-page">
      <PageHeader
        title="Search Chemicals"
        subtitle="Search by name, CAS number, synonym, formula, application or supplier capability — or by chemical structure."
      />

      <Suspense key={params.toString()} fallback={<SearchSkeleton />}>
        <SearchResults params={params} />
      </Suspense>
    </div>
  );
}

const FACETS = {
  applications: APPLICATIONS,
  categories: CATEGORIES,
  locations: LOCATIONS,
  equipment: EQUIPMENT_MASTER,
  statuses: PRODUCT_STATUSES,
};

const STRUCTURE_MODES = ['substructure', 'similarity', 'exact'];

async function SearchResults({ params }: { params: URLSearchParams }) {
  if (STRUCTURE_MODES.includes(params.get('mode') ?? '')) {
    return <StructureResults params={params} />;
  }

  const query = parseProductQuery(params);
  // Search results are browsed, not paged through — return a generous
  // window and let the client sort/switch views without a round trip.
  const results = await repo.listProducts({ ...query, pageSize: 60, page: 1 });

  const view = params.get('view') === 'list' ? 'list' : 'grid';
  const q = params.get('q') ?? undefined;
  const hasFilters = ['q', 'status', 'application', 'category', 'location', 'equipment'].some((k) =>
    params.get(k),
  );

  return (
    <Stack gap={20}>
      <SearchControls facets={FACETS} resultCount={results.total} popular={POPULAR} />

      {results.rows.length === 0 ? (
        <EmptyState
          icon={<SearchX size={22} />}
          title={hasFilters ? 'No chemicals match this search' : 'Start typing to search'}
          description={
            hasFilters
              ? 'Try a shorter term, a CAS number without hyphens, or clear a filter or two. Search also matches synonyms and molecular formulae.'
              : 'Search by product name, CAS number, synonym, molecular formula, company, application or supplier capability.'
          }
          action={hasFilters ? <Button variant="secondary" href="/search">Clear search</Button> : undefined}
        />
      ) : (
        <div className={view === 'grid' ? 'astra-grid astra-grid--cards' : 'astra-results-list'}>
          {results.rows.map((product) => (
            <ProductResultCard key={product.id} product={product} query={q} view={view} />
          ))}
        </div>
      )}

      {results.total > results.rows.length && (
        <p style={{ textAlign: 'center', fontSize: 'var(--vbds-caption-size)', color: 'var(--vbds-text-tertiary)' }}>
          Showing the first {results.rows.length} of {results.total} matches — narrow the search with filters, or{' '}
          <a href="/products" style={{ color: 'var(--vbds-primary)' }}>
            browse the full products table
          </a>
          .
        </p>
      )}
    </Stack>
  );
}

/* ── Structure search ───────────────────────────────────────────── */

async function StructureResults({ params }: { params: URLSearchParams }) {
  const view = params.get('view') === 'list' ? 'list' : 'grid';
  let query: StructureQuery | null = null;
  let result: StructureSearchResult | null = null;
  let error: string | null = null;

  // A bad query is the user's to fix, not a page failure: show it inline
  // rather than letting the ZodError reach the error boundary.
  try {
    query = parseStructureQuery(params);
    if (query) result = await repo.structureSearch(query);
  } catch (e) {
    if (!(e instanceof ZodError)) throw e;
    error = e.issues[0]?.message ?? 'That structure query could not be read.';
  }

  return (
    <Stack gap={20}>
      <SearchControls facets={FACETS} resultCount={result?.total ?? 0} popular={POPULAR} />

      {error ? (
        <EmptyState
          tone="danger"
          icon={<TriangleAlert size={22} />}
          title="Can’t search for that structure"
          description={error}
        />
      ) : !result ? (
        <EmptyState
          icon={<Hexagon size={22} />}
          title="Enter a structure to search"
          description="Paste a SMILES string — from PubChem, or ChemDraw › Copy As › SMILES — or pick an example above."
        />
      ) : (
        <>
          <p className="astra-structure-summary">
            Read as {result.interpretedAs}
            {result.canonicalQuery && (
              <>
                {' '}
                <span className="astra-table__mono">{result.canonicalQuery}</span>
              </>
            )}{' '}
            · compared {result.searched} {result.searched === 1 ? 'structure' : 'structures'}
            {result.withoutStructure > 0 &&
              ` · ${result.withoutStructure} ${result.withoutStructure === 1 ? 'product' : 'products'} in scope ${result.withoutStructure === 1 ? 'has' : 'have'} no recorded structure and can’t match`}
          </p>

          {result.hits.length === 0 ? (
            <EmptyState
              icon={<SearchX size={22} />}
              title="No products match this structure"
              description={
                result.mode === 'similarity'
                  ? 'Try a lower minimum similarity, or a smaller query.'
                  : result.mode === 'exact'
                    ? 'No product has this structure. Try similarity search to find close analogues.'
                    : 'No product contains this fragment. Try a smaller fragment, or similarity search.'
              }
            />
          ) : (
            <div className={view === 'grid' ? 'astra-grid astra-grid--cards' : 'astra-results-list'}>
              {result.hits.map((hit) => (
                <ProductResultCard
                  key={hit.product.id}
                  product={hit.product}
                  view={view}
                  matchLabel={matchLabel(hit)}
                  structure={
                    <StructureImage smiles={hit.product.smiles} name={hit.product.name} size="wide" highlight={hit.highlight} />
                  }
                />
              ))}
            </div>
          )}

          {result.total > result.hits.length && (
            <p className="astra-structure-summary" style={{ textAlign: 'center' }}>
              Showing the best {result.hits.length} of {result.total} matches — narrow the search with filters or a larger fragment.
            </p>
          )}
        </>
      )}
    </Stack>
  );
}

function matchLabel(hit: StructureHit): string {
  const pct = Math.round(hit.score * 100);
  switch (hit.matchKind) {
    case 'exact':
      return 'Exact match';
    case 'connectivity':
      return 'Same connectivity';
    case 'similar':
      return `${pct}% similar`;
    case 'substructure':
      return `Fragment covers ${pct}%`;
  }
}

function SearchSkeleton() {
  return (
    <Stack gap={20}>
      <div className="astra-search-panel">
        <Skeleton height={60} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Skeleton width={90} height={30} />
          <Skeleton width={110} height={30} />
          <Skeleton width={80} height={30} />
        </div>
      </div>
      <div className="astra-grid astra-grid--cards">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="vbds-card vbds-card--pad-md">
            <Skeleton variant="text" width="70%" />
            <div style={{ height: 10 }} />
            <Skeleton variant="text" width="40%" />
            <div style={{ height: 16 }} />
            <Skeleton height={22} width="60%" />
          </div>
        ))}
      </div>
    </Stack>
  );
}
