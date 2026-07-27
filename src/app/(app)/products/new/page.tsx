import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page/PageHeader';
import { APPLICATIONS, CATEGORIES } from '@/data/masters';
import { auth } from '@/server/auth';
import { can } from '@/server/rbac';
import { repo } from '@/server/repo';
import { ProductWizard } from './ProductWizard';

export const metadata: Metadata = { title: 'Add Product' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const session = await auth();
  // Server-side authorisation. Hiding the button is a courtesy; this is
  // the control.
  if (!can(session?.user.role, 'product:create')) redirect('/products');

  const companies = await repo.listCompanies({ page: 1, pageSize: 200, sort: 'name' });

  return (
    <div className="astra-page">
      <PageHeader
        title="Add Product"
        subtitle="Three steps: identify the chemical, map its suppliers, review and submit."
        crumbs={[
          { label: 'ASTRA', href: '/dashboard' },
          { label: 'Products', href: '/products' },
          { label: 'Add Product' },
        ]}
      />

      <ProductWizard applications={APPLICATIONS} categories={CATEGORIES} companies={companies.rows} />
    </div>
  );
}
