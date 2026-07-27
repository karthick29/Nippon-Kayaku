import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchX } from 'lucide-react';
import { PageHeader, Stack } from '@/components/page/PageHeader';
import { ProductResultCard } from '@/components/search/ProductResultCard';
import { Button, EmptyState, Skeleton } from '@/components/vbds';
import { APPLICATIONS, CATEGORIES, EQUIPMENT_MASTER, LOCATIONS } from '@/data/masters';
import { PRODUCT_STATUSES } from '@/lib/types';
import { parseProductQuery } from '@/lib/validation';
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
        subtitle="One query across product names, CAS numbers, synonyms, formulae, applications and supplier capability."
      />

      <Suspense key={params.toString()} fallback={<SearchSkeleton />}>
        <SearchResults params={params} />
      </Suspense>
    </div>
  );
}

async function SearchResults({ params }: { params: URLSearchParams }) {
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
      <SearchControls
        facets={{
          applications: APPLICATIONS,
          categories: CATEGORIES,
          locations: LOCATIONS,
          equipment: EQUIPMENT_MASTER,
          statuses: PRODUCT_STATUSES,
        }}
        resultCount={results.total}
        popular={POPULAR}
      />

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
