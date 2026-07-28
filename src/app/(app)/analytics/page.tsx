import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Building2, FlaskConical, Layers, Link2, MapPin, Wrench } from 'lucide-react';
import { PageHeader, Stack } from '@/components/page/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { MagnitudeBars } from '@/components/charts/MagnitudeBars';
import { withHref } from '@/components/charts/chart-theme';
import { StatusStack } from '@/components/charts/StatusStack';
import { TrendChart } from '@/components/charts/TrendChart';
import { Card, CardHeader, StatCard, StatGridSkeleton } from '@/components/vbds';
import { formatNumber } from '@/lib/format';
import { repo } from '@/server/repo';

export const metadata: Metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  return (
    <div className="astra-page">
      <PageHeader
        title="Analytics"
        subtitle="Portfolio shape, supplier footprint and capability depth across the whole catalogue."
        crumbs={[{ label: 'nipponkayaku', href: '/dashboard' }, { label: 'Analytics' }]}
      />

      <Suspense fallback={<StatGridSkeleton count={6} />}>
        <AnalyticsBody />
      </Suspense>
    </div>
  );
}

async function AnalyticsBody() {
  const [metrics, coverage, companies] = await Promise.all([
    repo.dashboard(),
    repo.equipmentCoverage(),
    repo.allCompanies(),
  ]);

  const totalStaff = companies.reduce((sum, c) => sum + c.chemicalStaff, 0);
  const totalPhd = companies.reduce((sum, c) => sum + c.phdCount, 0);

  const staffByCompany = companies
    .map((c) => ({ key: c.id, label: c.name, value: c.chemicalStaff }))
    .sort((a, b) => b.value - a.value);

  const phdByCompany = companies
    .map((c) => ({ key: c.id, label: c.name, value: c.phdCount }))
    .sort((a, b) => b.value - a.value);

  const byDecade = new Map<string, number>();
  for (const company of companies) {
    const decade = `${Math.floor(company.established / 10) * 10}s`;
    byDecade.set(decade, (byDecade.get(decade) ?? 0) + 1);
  }
  const decadeBuckets = Array.from(byDecade, ([label, value]) => ({ key: label, label, value })).sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  const coverageBuckets = coverage.map((c) => ({ key: c.key, label: c.name, value: c.companies }));

  return (
    <Stack gap={16}>
      <div className="astra-grid astra-grid--stats">
        <StatCard label="Products" value={metrics.totalProducts} icon={<FlaskConical size={16} />} tone="primary" />
        <StatCard label="Companies" value={metrics.totalCompanies} icon={<Building2 size={16} />} tone="secondary" />
        <StatCard
          label="Supply links"
          value={metrics.totalLinks}
          icon={<Link2 size={16} />}
          tone="accent"
          caption={`${metrics.avgCompaniesPerProduct} per product`}
        />
        <StatCard label="Locations" value={metrics.totalLocations} icon={<MapPin size={16} />} tone="info" />
        <StatCard
          label="Chemical staff"
          value={formatNumber(totalStaff)}
          icon={<Layers size={16} />}
          tone="success"
          caption="across the panel"
        />
        <StatCard
          label="PhD chemists"
          value={formatNumber(totalPhd)}
          icon={<Wrench size={16} />}
          tone="warning"
          caption={`${Math.round((totalPhd / Math.max(1, totalStaff)) * 100)}% of staff`}
        />
      </div>

      <Card padding="md">
        <CardHeader
          title="Catalogue growth"
          subtitle="Products and companies added per month, rolling 12 months"
        />
        <TrendChart data={metrics.monthlyAdditions} height={240} />
      </Card>

      <div className="astra-grid astra-grid--2">
        <ChartCard
          title="Products per company"
          subtitle="Which suppliers carry the most of the catalogue"
          valueLabel="Products"
          data={metrics.topCompanies}
        >
          <MagnitudeBars data={metrics.topCompanies} limit={10} unit="products" />
        </ChartCard>

        <ChartCard
          title="Products by application"
          subtitle="Portfolio concentration"
          valueLabel="Products"
          data={metrics.byApplication}
        >
          <MagnitudeBars data={withHref(metrics.byApplication, '/products?application=')} limit={10} />
        </ChartCard>

        <ChartCard
          title="Companies by location"
          subtitle="Geographic footprint"
          valueLabel="Companies"
          data={metrics.byCity}
        >
          <MagnitudeBars data={withHref(metrics.byCity, '/companies?location=')} limit={10} />
        </ChartCard>

        <ChartCard
          title="Products by status"
          subtitle="Lifecycle composition of the catalogue"
          valueLabel="Products"
          data={metrics.byStatus}
        >
          <StatusStack data={metrics.byStatus} />
        </ChartCard>

        <ChartCard
          title="Equipment availability"
          subtitle="How many companies have each capability"
          valueLabel="Companies"
          data={coverageBuckets}
        >
          <MagnitudeBars data={coverageBuckets} limit={15} unit="companies" />
        </ChartCard>

        <ChartCard
          title="Products by category"
          subtitle="Type of chemistry across the catalogue"
          valueLabel="Products"
          data={metrics.byCategory}
        >
          <MagnitudeBars data={withHref(metrics.byCategory, '/products?category=')} />
        </ChartCard>

        <ChartCard
          title="Chemical staff by company"
          subtitle="Relative scale of each partner's chemistry team"
          valueLabel="Staff"
          data={staffByCompany}
        >
          <MagnitudeBars data={staffByCompany} limit={10} unit="staff" />
        </ChartCard>

        <ChartCard
          title="PhD depth by company"
          subtitle="Doctorate-level chemists on staff"
          valueLabel="PhD"
          data={phdByCompany}
        >
          <MagnitudeBars data={phdByCompany} limit={10} unit="PhD" />
        </ChartCard>

        <ChartCard
          title="Companies by founding decade"
          subtitle="How established the supplier panel is"
          valueLabel="Companies"
          data={decadeBuckets}
        >
          <MagnitudeBars data={decadeBuckets} unit="companies" />
        </ChartCard>
      </div>
    </Stack>
  );
}
