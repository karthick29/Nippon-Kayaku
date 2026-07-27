import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Activity,
  Beaker,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Info,
  Mail,
  MapPin,
  Minus,
  Users,
  Wrench,
} from 'lucide-react';
import { PageHeader, Stack } from '@/components/page/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { MagnitudeBars } from '@/components/charts/MagnitudeBars';
import { StatusStack } from '@/components/charts/StatusStack';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  DescriptionItem,
  DescriptionList,
  Divider,
  EmptyState,
  LinkTabs,
  ProgressBar,
  StatCard,
} from '@/components/vbds';
import { EQUIPMENT_MASTER } from '@/data/masters';
import { formatDate, formatNumber, orDash } from '@/lib/format';
import { statusTone } from '@/lib/status';
import { repo } from '@/server/repo';
import type { CompanyEquipment, EquipmentMaster, ProductRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ tab?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const company = await repo.getCompany(slug);
  return { title: company ? company.name : 'Company not found' };
}

const TABS = [
  { value: 'overview', label: 'Overview', icon: <Info size={14} /> },
  { value: 'equipment', label: 'Equipment', icon: <Wrench size={14} /> },
  { value: 'products', label: 'Products', icon: <FlaskConical size={14} /> },
  { value: 'capabilities', label: 'Capabilities', icon: <Beaker size={14} /> },
  { value: 'analytics', label: 'Analytics', icon: <ChartNoAxesColumn size={14} /> },
];

export default async function CompanyProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ slug }, { tab }] = await Promise.all([params, searchParams]);

  const company = await repo.getCompany(slug);
  if (!company) notFound();

  const activeTab = TABS.some((t) => t.value === tab) ? tab! : 'overview';

  const [equipment, products] = await Promise.all([
    repo.getCompanyEquipment(company.id),
    repo.getCompanyProducts(company.id),
  ]);

  const available = equipment.filter((e) => e.available);

  return (
    <div className="astra-page astra-page--wide">
      <PageHeader
        title=""
        crumbs={[
          { label: 'ASTRA', href: '/dashboard' },
          { label: 'Companies', href: '/companies' },
          { label: company.name },
        ]}
      />

      <Card padding="md" style={{ marginTop: -8 }}>
        <div className="astra-detail-header">
          <Avatar name={company.name} size="xl" />

          <div className="astra-detail-header__main">
            <h1 className="astra-detail-header__title">{company.name}</h1>
            <div className="astra-detail-header__meta">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} aria-hidden="true" />
                {company.locationName}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CalendarDays size={12} aria-hidden="true" />
                Established {company.established}
              </span>
              <Badge tone="secondary" size="sm">
                {available.length} of {EQUIPMENT_MASTER.length} capabilities
              </Badge>
              <Badge tone="primary" size="sm">
                {products.length} products
              </Badge>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--vbds-primary)',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={12} aria-hidden="true" />
                  Website
                </a>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--vbds-space-16)' }}>
          <LinkTabs
            ariaLabel="Company sections"
            activeValue={activeTab}
            tabs={TABS.map((t) => ({
              ...t,
              href: `/companies/${company.slug}${t.value === 'overview' ? '' : `?tab=${t.value}`}`,
              count:
                t.value === 'equipment'
                  ? available.length
                  : t.value === 'products'
                    ? products.length
                    : undefined,
            }))}
          />
        </div>
      </Card>

      <div style={{ marginTop: 'var(--vbds-space-16)' }}>
        {activeTab === 'overview' && (
          <OverviewTab company={company} equipment={equipment} products={products} />
        )}
        {activeTab === 'equipment' && <EquipmentTab equipment={equipment} master={EQUIPMENT_MASTER} />}
        {activeTab === 'products' && <ProductsTab products={products} />}
        {activeTab === 'capabilities' && (
          <CapabilitiesTab company={company} equipment={equipment} master={EQUIPMENT_MASTER} />
        )}
        {activeTab === 'analytics' && <CompanyAnalyticsTab products={products} equipment={equipment} />}
      </div>
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────────────── */

function OverviewTab({
  company,
  equipment,
  products,
}: {
  company: NonNullable<Awaited<ReturnType<typeof repo.getCompany>>>;
  equipment: CompanyEquipment[];
  products: ProductRow[];
}) {
  const available = equipment.filter((e) => e.available);

  return (
    <Stack gap={16}>
      <div className="astra-grid astra-grid--stats">
        <StatCard
          label="Chemical Staff"
          value={formatNumber(company.chemicalStaff)}
          icon={<Users size={16} />}
          tone="primary"
        />
        <StatCard
          label="PhD"
          value={company.phdCount}
          icon={<GraduationCap size={16} />}
          tone="accent"
          caption={`${Math.round((company.phdCount / Math.max(1, company.chemicalStaff)) * 100)}% of staff`}
        />
        <StatCard
          label="Established"
          value={company.established}
          icon={<CalendarDays size={16} />}
          tone="secondary"
          caption={`${2026 - company.established} years operating`}
        />
        <StatCard
          label="Equipment"
          value={`${available.length}/${EQUIPMENT_MASTER.length}`}
          icon={<Wrench size={16} />}
          tone="info"
          caption="capabilities available"
        />
        <StatCard
          label="Products"
          value={products.length}
          icon={<FlaskConical size={16} />}
          tone="success"
          caption="in the catalogue"
        />
      </div>

      <div className="astra-grid astra-grid--2">
        <Card padding="md">
          <CardHeader title="Company profile" subtitle="Facts of record" />
          <DescriptionList>
            <DescriptionItem term="Company name">{company.name}</DescriptionItem>
            <DescriptionItem term="Location">{company.locationName}</DescriptionItem>
            <DescriptionItem term="Established">{company.established}</DescriptionItem>
            <DescriptionItem term="Chemical staff">{formatNumber(company.chemicalStaff)}</DescriptionItem>
            <DescriptionItem term="PhD chemists">{company.phdCount}</DescriptionItem>
            <DescriptionItem term="Capital">{orDash(company.capital)}</DescriptionItem>
            <DescriptionItem term="Presentation">{orDash(company.presentation)}</DescriptionItem>
            <DescriptionItem term="Added">{formatDate(company.createdAt)}</DescriptionItem>
          </DescriptionList>

          {(company.website || company.contactEmail) && (
            <>
              <div style={{ margin: 'var(--vbds-space-20) 0 var(--vbds-space-12)' }}>
                <Divider label="Contact" />
              </div>
              <div style={{ display: 'flex', gap: 'var(--vbds-space-16)', flexWrap: 'wrap' }}>
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--vbds-primary)', fontSize: 'var(--vbds-caption-size)' }}
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    {company.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {company.contactEmail && (
                  <a
                    href={`mailto:${company.contactEmail}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--vbds-primary)', fontSize: 'var(--vbds-caption-size)' }}
                  >
                    <Mail size={13} aria-hidden="true" />
                    {company.contactEmail}
                  </a>
                )}
              </div>
            </>
          )}
        </Card>

        <Card padding="md">
          <CardHeader title="Headline strength" subtitle="What this site is best at" />
          <p style={{ color: 'var(--vbds-text)', lineHeight: 'var(--vbds-body-line)', fontWeight: 500 }}>
            {orDash(company.strength)}
          </p>

          {company.remarks && (
            <>
              <div style={{ margin: 'var(--vbds-space-20) 0 var(--vbds-space-12)' }}>
                <Divider label="Remarks" />
              </div>
              <p style={{ color: 'var(--vbds-text-secondary)', lineHeight: 'var(--vbds-body-line)' }}>
                {company.remarks}
              </p>
            </>
          )}

          <div style={{ margin: 'var(--vbds-space-20) 0 var(--vbds-space-12)' }}>
            <Divider label="Capability coverage" />
          </div>
          <ProgressBar
            value={(available.length / EQUIPMENT_MASTER.length) * 100}
            label={`${available.length} of ${EQUIPMENT_MASTER.length} capabilities available`}
          />
          <p style={{ marginTop: 8, fontSize: 'var(--vbds-caption-size)', color: 'var(--vbds-text-tertiary)' }}>
            {available.length} of {EQUIPMENT_MASTER.length} tracked capabilities available on site.
          </p>
        </Card>
      </div>
    </Stack>
  );
}

/* ── Equipment ──────────────────────────────────────────────────── */

function EquipmentTab({
  equipment,
  master,
}: {
  equipment: CompanyEquipment[];
  master: EquipmentMaster[];
}) {
  const byGroup = new Map<string, Array<{ entry: CompanyEquipment | undefined; spec: EquipmentMaster }>>();

  for (const spec of master) {
    const entry = equipment.find((e) => e.equipmentKey === spec.key);
    const list = byGroup.get(spec.group) ?? [];
    list.push({ entry, spec });
    byGroup.set(spec.group, list);
  }

  return (
    <Stack gap={20}>
      {Array.from(byGroup, ([group, items]) => (
        <div key={group}>
          <div style={{ marginBottom: 'var(--vbds-space-12)' }}>
            <Divider label={group} />
          </div>
          <div className="astra-grid astra-grid--cards">
            {items.map(({ entry, spec }) => {
              const available = !!entry?.available;
              return (
                <div key={spec.key} className={`astra-equip${available ? '' : ' astra-equip--unavailable'}`}>
                  <div className="astra-equip__top">
                    <span className="astra-equip__icon" aria-hidden="true">
                      <Wrench size={15} />
                    </span>
                    <span className="astra-equip__name">{spec.name}</span>
                    {available ? (
                      <Badge tone="success" size="sm">
                        <Check size={10} aria-hidden="true" />
                        Available
                      </Badge>
                    ) : (
                      <Badge size="sm">
                        <Minus size={10} aria-hidden="true" />
                        Not available
                      </Badge>
                    )}
                  </div>

                  <dl className="astra-equip__rows">
                    <div className="astra-equip__row">
                      <dt>Specification</dt>
                      <dd title={entry?.specification ?? undefined}>
                        {available
                          ? spec.valueType === 'count'
                            ? `${entry?.count ?? 0} ${spec.unit ?? ''}`.trim()
                            : orDash(entry?.specification ?? (spec.valueType === 'boolean' ? 'Yes' : undefined))
                          : '—'}
                      </dd>
                    </div>
                    <div className="astra-equip__row">
                      <dt>Capacity</dt>
                      <dd title={entry?.capacity ?? undefined}>{available ? orDash(entry?.capacity) : '—'}</dd>
                    </div>
                    <div className="astra-equip__row">
                      <dt>Remarks</dt>
                      <dd title={entry?.remarks ?? undefined}>{orDash(entry?.remarks)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Stack>
  );
}

/* ── Products ───────────────────────────────────────────────────── */

function ProductsTab({ products }: { products: ProductRow[] }) {
  if (products.length === 0) {
    return (
      <Card padding="md">
        <EmptyState
          icon={<FlaskConical size={22} />}
          title="No products mapped to this company"
          description="Attach this company to a product from the product page and it will appear here."
        />
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="astra-scroll-x">
        <table className="astra-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>CAS Number</th>
              <th>Application</th>
              <th>Category</th>
              <th>Status</th>
              <th>Other suppliers</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link href={`/products/${product.slug}`} className="astra-table__link" title={product.name}>
                    {product.name}
                  </Link>
                </td>
                <td className="astra-table__mono">{product.casNumber}</td>
                <td>
                  <Badge tone="primary" size="sm">
                    {product.applicationName}
                  </Badge>
                </td>
                <td>{product.categoryName}</td>
                <td>
                  <Badge tone={statusTone(product.status)} size="sm" dot>
                    {product.status}
                  </Badge>
                </td>
                <td className="astra-table__num">{Math.max(0, product.companyCount - 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Capabilities ───────────────────────────────────────────────── */

function CapabilitiesTab({
  company,
  equipment,
  master,
}: {
  company: NonNullable<Awaited<ReturnType<typeof repo.getCompany>>>;
  equipment: CompanyEquipment[];
  master: EquipmentMaster[];
}) {
  const groups = Array.from(new Set(master.map((m) => m.group)));

  const coverage = groups.map((group) => {
    const specs = master.filter((m) => m.group === group);
    const have = specs.filter((s) => equipment.find((e) => e.equipmentKey === s.key)?.available).length;
    return { key: group, label: group, value: have, total: specs.length };
  });

  return (
    <Stack gap={16}>
      <div className="astra-grid astra-grid--2">
        <ChartCard
          title="Capability coverage by group"
          subtitle="How complete this site is in each area"
          valueLabel="Available"
          data={coverage}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--vbds-space-16)' }}>
            {coverage.map((group) => (
              <div key={group.key}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                    fontSize: 'var(--vbds-caption-size)',
                  }}
                >
                  <span style={{ fontWeight: 550 }}>{group.label}</span>
                  <span style={{ color: 'var(--vbds-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {group.value} of {group.total}
                  </span>
                </div>
                <ProgressBar
                  value={(group.value / group.total) * 100}
                  label={`${group.label}: ${group.value} of ${group.total} available`}
                  tone={group.value === group.total ? 'success' : group.value === 0 ? 'danger' : 'primary'}
                />
              </div>
            ))}
          </div>
        </ChartCard>

        <Card padding="md">
          <CardHeader title="Scale and staffing" subtitle="What the site can absorb" />
          <DescriptionList>
            <DescriptionItem term="Chemical staff">{formatNumber(company.chemicalStaff)}</DescriptionItem>
            <DescriptionItem term="PhD chemists">{company.phdCount}</DescriptionItem>
            <DescriptionItem term="PhD ratio">
              {Math.round((company.phdCount / Math.max(1, company.chemicalStaff)) * 100)}%
            </DescriptionItem>
            <DescriptionItem term="Fume hoods">
              {equipment.find((e) => e.equipmentKey === 'hoods')?.count ?? '—'}
            </DescriptionItem>
            <DescriptionItem term="Kilo lab">
              {orDash(equipment.find((e) => e.equipmentKey === 'kiloLab')?.specification)}
            </DescriptionItem>
            <DescriptionItem term="Pilot plant">
              {orDash(equipment.find((e) => e.equipmentKey === 'pilotPlant')?.specification)}
            </DescriptionItem>
            <DescriptionItem term="Flow chemistry">
              {equipment.find((e) => e.equipmentKey === 'flowChemistry')?.available ? 'Yes' : 'No'}
            </DescriptionItem>
            <DescriptionItem term="Incineration">
              {equipment.find((e) => e.equipmentKey === 'incineration')?.available ? 'On site' : 'No'}
            </DescriptionItem>
          </DescriptionList>

          <div style={{ margin: 'var(--vbds-space-20) 0 var(--vbds-space-12)' }}>
            <Divider label="Presentation" />
          </div>
          <p style={{ color: 'var(--vbds-text-secondary)' }}>{orDash(company.presentation)}</p>
        </Card>
      </div>

      <Card padding="md">
        <CardHeader title="Full capability matrix" subtitle="Every tracked capability, available or not" />
        <div className="astra-scroll-x">
          <table className="astra-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Group</th>
                <th>Available</th>
                <th>Specification</th>
                <th>Capacity</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {master.map((spec) => {
                const entry = equipment.find((e) => e.equipmentKey === spec.key);
                return (
                  <tr key={spec.key}>
                    <td style={{ fontWeight: 550 }}>{spec.name}</td>
                    <td>{spec.group}</td>
                    <td>
                      {entry?.available ? (
                        <Badge tone="success" size="sm">
                          Yes
                        </Badge>
                      ) : (
                        <Badge size="sm">No</Badge>
                      )}
                    </td>
                    <td>
                      {entry?.available
                        ? spec.valueType === 'count'
                          ? `${entry.count ?? 0} ${spec.unit ?? ''}`.trim()
                          : orDash(entry.specification ?? (spec.valueType === 'boolean' ? 'Yes' : undefined))
                        : '—'}
                    </td>
                    <td>{orDash(entry?.capacity)}</td>
                    <td title={entry?.remarks}>{orDash(entry?.remarks)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </Stack>
  );
}

/* ── Analytics ──────────────────────────────────────────────────── */

function CompanyAnalyticsTab({
  products,
  equipment,
}: {
  products: ProductRow[];
  equipment: CompanyEquipment[];
}) {
  if (products.length === 0) {
    return (
      <Card padding="md">
        <EmptyState
          icon={<ChartNoAxesColumn size={22} />}
          title="Nothing to analyse yet"
          description="Map products to this company and its portfolio analytics will populate."
        />
      </Card>
    );
  }

  const byApplication = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const byCategory = new Map<string, number>();

  for (const product of products) {
    byApplication.set(product.applicationName, (byApplication.get(product.applicationName) ?? 0) + 1);
    byStatus.set(product.status, (byStatus.get(product.status) ?? 0) + 1);
    byCategory.set(product.categoryName, (byCategory.get(product.categoryName) ?? 0) + 1);
  }

  const toBuckets = (map: Map<string, number>) =>
    Array.from(map, ([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value);

  // Only count-typed capabilities have a meaningful magnitude; spec and
  // boolean ones would all render as "1" and read as noise.
  const availableEquipment = equipment
    .filter((e) => e.available)
    .map((e) => ({ entry: e, spec: EQUIPMENT_MASTER.find((m) => m.key === e.equipmentKey) }))
    .filter((e) => e.spec?.valueType === 'count' && (e.entry.count ?? 0) > 0)
    .map((e) => ({
      key: e.entry.equipmentKey,
      label: e.spec!.name,
      value: e.entry.count ?? 0,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="astra-grid astra-grid--2">
      <ChartCard
        title="Portfolio by application"
        subtitle="Where this company's products sit"
        valueLabel="Products"
        data={toBuckets(byApplication)}
      >
        <MagnitudeBars data={toBuckets(byApplication)} limit={8} />
      </ChartCard>

      <ChartCard
        title="Portfolio by status"
        subtitle="Lifecycle composition"
        valueLabel="Products"
        data={toBuckets(byStatus)}
      >
        <StatusStack data={toBuckets(byStatus)} />
      </ChartCard>

      <ChartCard
        title="Portfolio by category"
        subtitle="Type of chemistry supplied"
        valueLabel="Products"
        data={toBuckets(byCategory)}
      >
        <MagnitudeBars data={toBuckets(byCategory)} />
      </ChartCard>

      <ChartCard
        title="Analytical and reaction capacity"
        subtitle="Units of each available capability"
        valueLabel="Units"
        data={availableEquipment}
      >
        <MagnitudeBars data={availableEquipment} limit={10} unit="units" />
      </ChartCard>
    </div>
  );
}
