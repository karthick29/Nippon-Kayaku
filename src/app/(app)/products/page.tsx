import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/page/PageHeader';
import { Button, TableSkeleton } from '@/components/vbds';
import { APPLICATIONS, CATEGORIES } from '@/data/masters';
import { parseProductQuery } from '@/lib/validation';
import { auth } from '@/server/auth';
import { can } from '@/server/rbac';
import { repo } from '@/server/repo';
import { ProductsTable } from './ProductsTable';

export const metadata: Metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams;
  const session = await auth();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }

  return (
    <div className="astra-page astra-page--wide">
      <PageHeader
        title="Products"
        subtitle="Every chemical in the catalogue, with the companies that can supply it."
        crumbs={[{ label: 'nipponkayaku', href: '/dashboard' }, { label: 'Products' }]}
        actions={
          can(session?.user.role, 'product:create') ? (
            <Button href="/products/new" icon={<Plus size={14} />}>
              Add Product
            </Button>
          ) : undefined
        }
      />

      <Suspense fallback={<TableSkeleton rows={10} cols={7} />}>
        <ProductsTableLoader params={params} role={session?.user.role ?? 'VIEWER'} />
      </Suspense>
    </div>
  );
}

async function ProductsTableLoader({
  params,
  role,
}: {
  params: URLSearchParams;
  role: 'ADMIN' | 'MANAGER' | 'ANALYST' | 'VIEWER';
}) {
  const query = parseProductQuery(params);
  // The table sorts and pages client-side, so hand it the whole filtered
  // set once rather than re-fetching on every sort click.
  const result = await repo.listProducts({ ...query, page: 1, pageSize: 200 });

  return (
    <ProductsTable
      products={result.rows}
      applications={APPLICATIONS}
      categories={CATEGORIES}
      role={role}
    />
  );
}
