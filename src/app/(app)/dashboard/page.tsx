import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  Activity,
  ArrowUpRight,
  Beaker,
  Building2,
  FlaskConical,
  Link2,
  MapPin,
  Plus,
  Rocket,
  Tags,
} from 'lucide-react';
import { PageHeader, Stack } from '@/components/page/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { MagnitudeBars } from '@/components/charts/MagnitudeBars';
import { withCompanyHref, withHref } from '@/components/charts/chart-theme';
import { StatusStack } from '@/components/charts/StatusStack';
import { TrendChart } from '@/components/charts/TrendChart';
import { Badge, Button, Card, CardHeader, StatCard, StatGridSkeleton } from '@/components/vbds';
import { DashboardSearch } from './DashboardSearch';
import { formatRelative, formatDate } from '@/lib/format';
import { auth } from '@/server/auth';
import { can } from '@/server/rbac';
import { repo } from '@/server/repo';
import { statusTone } from '@/lib/status';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user.role;
  const firstName = session?.user.name.split(' ')[0] ?? 'there';

  return (
    <div className="astra-page">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        subtitle="Portfolio coverage across products, suppliers and manufacturing capability."
        actions={
          <>
            <Button variant="outlined" href="/reports" icon={<ArrowUpRight size={14} />}>
              Reports
            </Button>
            {can(role, 'product:create') && (
              <Button href="/products/new" icon={<Plus size={14} />}>
                Add Product
              </Button>
            )}
          </>
        }
      />

      <Suspense fallback={<StatGridSkeleton count={6} />}>
        <DashboardBody />
      </Suspense>
    </div>
  );
}

async function DashboardBody() {
  const metrics = await repo.dashboard();

  return (
    <Stack gap={16}>
      <DashboardSearch />

      <div className="astra-grid astra-grid--stats">
        <StatCard
          label="Total Products"
          value={metrics.totalProducts}
          icon={<FlaskConical size={16} />}
          tone="primary"
          caption={`${metrics.productsAddedLast30d} added in 30 days`}
          href="/products"
        />
        <StatCard
          label="Commercial"
          value={metrics.commercialProducts}
          icon={<Rocket size={16} />}
          tone="success"
          delta={`${Math.round((metrics.commercialProducts / Math.max(1, metrics.totalProducts)) * 100)}%`}
          trend="up"
          caption="of portfolio"
          href="/products?status=Commercial"
        />
        <StatCard
          label="Development"
          value={metrics.developmentProducts}
          icon={<Beaker size={16} />}
          tone="warning"
          caption="in the pipeline"
          href="/products?status=Development"
        />
        <StatCard
          label="Companies"
          value={metrics.totalCompanies}
          icon={<Building2 size={16} />}
          tone="secondary"
          caption={`${metrics.avgCompaniesPerProduct} avg per product`}
          href="/companies"
        />
        <StatCard
          label="Locations"
          value={metrics.totalLocations}
          icon={<MapPin size={16} />}
          tone="accent"
          caption="manufacturing sites"
          href="/analytics"
        />
        <StatCard
          label="Applications"
          value={metrics.totalApplications}
          icon={<Tags size={16} />}
          tone="info"
          caption={`${metrics.totalLinks} supply links`}
          href="/analytics"
        />
      </div>

      <div className="astra-grid astra-grid--2">
        <ChartCard
          title="Products by Application"
          subtitle="Where the portfolio is concentrated"
          valueLabel="Products"
          data={metrics.byApplication}
        >
          <MagnitudeBars data={withHref(metrics.byApplication, '/products?application=')} limit={7} />
        </ChartCard>

        <ChartCard
          title="Products by Status"
          subtitle="Lifecycle composition"
          valueLabel="Products"
          data={metrics.byStatus}
        >
          <StatusStack data={metrics.byStatus} />
        </ChartCard>
      </div>

      <div className="astra-grid astra-grid--2">
        <ChartCard
          title="Companies by City"
          subtitle="Supplier footprint"
          valueLabel="Companies"
          data={metrics.byCity}
        >
          <MagnitudeBars data={withHref(metrics.byCity, '/companies?location=')} limit={8} />
        </ChartCard>

        <ChartCard
          title="Additions over time"
          subtitle="Rolling 12 months"
          valueLabel="Added"
          data={metrics.monthlyAdditions.map((m) => ({
            key: m.month,
            label: m.month,
            value: m.products + m.companies,
          }))}
        >
          <TrendChart data={metrics.monthlyAdditions} />
        </ChartCard>
      </div>

      <div className="astra-grid astra-grid--2">
        <Card padding="md">
          <CardHeader
            title="Latest products"
            subtitle="Most recently added to the catalogue"
            action={
              <Button variant="text" size="sm" href="/products">
                View all
              </Button>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {metrics.recentProducts.map((product, index) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="astra-recent"
                style={{ borderTop: index === 0 ? 'none' : '1px solid var(--vbds-divider)' }}
              >
                <span className="astra-recent__glyph" aria-hidden="true">
                  <FlaskConical size={15} />
                </span>
                <span className="astra-recent__main">
                  <span className="astra-recent__title">{product.name}</span>
                  <span className="astra-recent__sub">
                    {product.casNumber} · {product.applicationName}
                  </span>
                </span>
                <span className="astra-recent__meta">
                  <Badge tone={statusTone(product.status)} size="sm">
                    {product.status}
                  </Badge>
                  <span className="astra-recent__date">{formatDate(product.createdAt)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card padding="md">
          <CardHeader
            title="Recent activity"
            subtitle="Who changed what, most recent first"
            action={
              <Button variant="text" size="sm" href="/settings/audit">
                Audit log
              </Button>
            }
          />
          <div className="astra-timeline">
            {metrics.recentActivity.map((entry) => (
              <div className="astra-timeline__item" key={entry.id}>
                <span
                  className={`astra-timeline__dot astra-timeline__dot--${entry.action.toLowerCase() === 'create' ? 'create' : entry.action.toLowerCase() === 'delete' ? 'delete' : 'update'}`}
                  aria-hidden="true"
                >
                  <Activity size={13} />
                </span>
                <div className="astra-timeline__main">
                  <div className="astra-timeline__title">{entry.summary}</div>
                  <div className="astra-timeline__meta">
                    {entry.actorName} · {formatRelative(entry.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card padding="md">
        <CardHeader
          title="Top companies by supply coverage"
          subtitle="Companies supplying the most products in the catalogue"
          action={
            <Button variant="text" size="sm" href="/companies" icon={<Link2 size={14} />}>
              All companies
            </Button>
          }
        />
        <MagnitudeBars data={withCompanyHref(metrics.topCompanies)} limit={8} unit="products" />
      </Card>
    </Stack>
  );
}
