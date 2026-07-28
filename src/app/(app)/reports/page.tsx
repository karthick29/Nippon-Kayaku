import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page/PageHeader';
import { EQUIPMENT_MASTER } from '@/data/masters';
import { auth } from '@/server/auth';
import { can } from '@/server/rbac';
import { repo } from '@/server/repo';
import { ReportBuilder } from './ReportBuilder';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = await auth();
  if (!can(session?.user.role, 'report:read')) redirect('/dashboard');

  const [products, companies] = await Promise.all([
    repo.listProducts({ page: 1, pageSize: 200, sort: 'name' }),
    repo.listCompanies({ page: 1, pageSize: 200, sort: 'name' }),
  ]);

  return (
    <div className="astra-page astra-page--wide">
      <PageHeader
        title="Reports"
        subtitle="Pick a report, check the preview, export as CSV, Excel or PDF."
        crumbs={[{ label: 'nipponkayaku', href: '/dashboard' }, { label: 'Reports' }]}
      />

      <ReportBuilder products={products.rows} companies={companies.rows} equipment={EQUIPMENT_MASTER} />
    </div>
  );
}
