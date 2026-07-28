import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader, Stack } from '@/components/page/PageHeader';
import { Building2, GraduationCap, MapPin, Users } from 'lucide-react';
import { StatCard, TableSkeleton } from '@/components/vbds';
import { EQUIPMENT_MASTER, LOCATIONS } from '@/data/masters';
import { formatNumber } from '@/lib/format';
import { parseCompanyQuery } from '@/lib/validation';
import { auth } from '@/server/auth';
import { repo } from '@/server/repo';
import { CompaniesTable } from './CompaniesTable';

export const metadata: Metadata = { title: 'Companies' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const [resolved, session] = await Promise.all([searchParams, auth()]);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }

  return (
    <div className="astra-page astra-page--wide">
      <PageHeader
        title="Companies"
        subtitle="Manufacturing partners, their people and their capability."
        crumbs={[{ label: 'nipponkayaku', href: '/dashboard' }, { label: 'Companies' }]}
      />

      <Suspense fallback={<TableSkeleton rows={10} cols={8} />}>
        <CompaniesLoader params={params} role={session?.user.role ?? 'VIEWER'} />
      </Suspense>
    </div>
  );
}

async function CompaniesLoader({
  params,
  role,
}: {
  params: URLSearchParams;
  role: 'ADMIN' | 'MANAGER' | 'ANALYST' | 'VIEWER';
}) {
  const query = parseCompanyQuery(params);
  const result = await repo.listCompanies({ ...query, page: 1, pageSize: 200 });

  const totalStaff = result.rows.reduce((sum, c) => sum + c.chemicalStaff, 0);
  const totalPhd = result.rows.reduce((sum, c) => sum + c.phdCount, 0);
  const cities = new Set(result.rows.map((c) => c.locationId)).size;

  return (
    <Stack gap={16}>
      <div className="astra-grid astra-grid--stats">
        <StatCard label="Companies" value={result.total} icon={<Building2 size={16} />} tone="primary" />
        <StatCard
          label="Chemical staff"
          value={formatNumber(totalStaff)}
          icon={<Users size={16} />}
          tone="secondary"
          caption="across the panel"
        />
        <StatCard
          label="PhD chemists"
          value={formatNumber(totalPhd)}
          icon={<GraduationCap size={16} />}
          tone="accent"
          caption={`${Math.round((totalPhd / Math.max(1, totalStaff)) * 100)}% of staff`}
        />
        <StatCard label="Locations" value={cities} icon={<MapPin size={16} />} tone="info" caption="cities" />
      </div>

      <CompaniesTable
        companies={result.rows}
        locations={LOCATIONS}
        equipment={EQUIPMENT_MASTER}
        role={role}
      />
    </Stack>
  );
}
