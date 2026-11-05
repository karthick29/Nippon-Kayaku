import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Activity,
  Building2,
  ChartNoAxesColumn,
  Download,
  FileText,
  FlaskConical,
  GitBranch,
  Info,
  MapPin,
} from 'lucide-react';
import { PageHeader, Stack } from '@/components/page/PageHeader';
import { ChartCard } from '@/components/charts/ChartCard';
import { StructureImage } from '@/components/chem/StructureImage';
import { MagnitudeBars } from '@/components/charts/MagnitudeBars';
import {
  Badge,
  Card,
  CardHeader,
  DescriptionItem,
  DescriptionList,
  Divider,
  EmptyState,
  LinkTabs,
  StatCard,
} from '@/components/vbds';
import { EQUIPMENT_MASTER } from '@/data/masters';
import { formatDate, formatDateTime, formatNumber, formatRelative, orDash } from '@/lib/format';
import { statusTone } from '@/lib/status';
import { auth } from '@/server/auth';
import { can } from '@/server/rbac';
import { repo } from '@/server/repo';
import { ProductActions } from './ProductActions';
import { ProductCompaniesTable } from './ProductCompaniesTable';
import { SynthesisTab } from './SynthesisTab';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ tab?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await repo.getProduct(slug);
  return {
    title: product ? `${product.name}` : 'Product not found',
    description: product?.description,
  };
}

const TABS = [
  { value: 'overview', label: 'Overview', icon: <Info size={14} /> },
  { value: 'companies', label: 'Companies', icon: <Building2 size={14} /> },
  { value: 'synthesis', label: 'Synthesis', icon: <GitBranch size={14} /> },
  { value: 'documents', label: 'Documents', icon: <FileText size={14} /> },
  { value: 'history', label: 'History', icon: <Activity size={14} /> },
  { value: 'analytics', label: 'Analytics', icon: <ChartNoAxesColumn size={14} /> },
];

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ slug }, { tab }, session] = await Promise.all([params, searchParams, auth()]);

  const product = await repo.getProduct(slug);
  if (!product) notFound();

  const activeTab = TABS.some((t) => t.value === tab) ? tab! : 'overview';

  const canEditRoutes = can(session?.user.role, 'product:update');
  const [companies, documents, history, routes, whereUsed] = await Promise.all([
    repo.getProductCompanies(product.id),
    repo.listDocuments({ productId: product.id }),
    repo.listEntityAuditLogs(product.id, 30),
    repo.listRoutes(product.id),
    repo.getWhereUsed(product.id),
  ]);
  // The route editor's product picker — only loaded when it can be used.
  const catalogue =
    activeTab === 'synthesis' && canEditRoutes
      ? (await repo.allProducts())
          .filter((p) => p.id !== product.id)
          .map((p) => ({ id: p.id, name: p.name, casNumber: p.casNumber }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

  return (
    <div className="astra-page astra-page--wide">
      <PageHeader
        title=""
        crumbs={[
          { label: 'nipponkayaku', href: '/dashboard' },
          { label: 'Products', href: '/products' },
          { label: product.name },
        ]}
      />

      <Card padding="md" style={{ marginTop: -8 }}>
        <div className="astra-detail-header">
          <span className="astra-detail-header__glyph" aria-hidden="true">
            <FlaskConical size={22} />
          </span>

          <div className="astra-detail-header__main">
            <h1 className="astra-detail-header__title">{product.name}</h1>
            <div className="astra-detail-header__meta">
              <span className="astra-table__mono" style={{ fontWeight: 600 }}>
                CAS {product.casNumber}
              </span>
              <Badge tone={statusTone(product.status)} dot>
                {product.status}
              </Badge>
              <Badge tone="primary">{product.applicationName}</Badge>
              <Badge>{product.categoryName}</Badge>
              {product.molecularFormula && (
                <span className="astra-table__mono">{product.molecularFormula}</span>
              )}
              <span>
                <Building2 size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
                {product.companyCount} {product.companyCount === 1 ? 'company' : 'companies'}
              </span>
            </div>
          </div>

          <div className="astra-page__actions">
            <ProductActions
              productId={product.id}
              productName={product.name}
              productSlug={product.slug}
              role={session?.user.role ?? 'VIEWER'}
            />
          </div>
        </div>

        <div style={{ marginTop: 'var(--vbds-space-16)' }}>
          <LinkTabs
            ariaLabel="Product sections"
            activeValue={activeTab}
            tabs={TABS.map((t) => ({
              ...t,
              href: `/products/${product.slug}${t.value === 'overview' ? '' : `?tab=${t.value}`}`,
              count:
                t.value === 'companies'
                  ? companies.length
                  : t.value === 'synthesis'
                    ? routes.length + whereUsed.length || undefined
                    : t.value === 'documents'
                    ? documents.length
                    : t.value === 'history'
                      ? history.length
                      : undefined,
            }))}
          />
        </div>
      </Card>

      <div style={{ marginTop: 'var(--vbds-space-16)' }}>
        {activeTab === 'overview' && <OverviewTab product={product} companies={companies} />}
        {activeTab === 'companies' && (
          <ProductCompaniesTable
            rows={companies}
            equipmentMaster={EQUIPMENT_MASTER}
            productName={product.name}
          />
        )}
        {activeTab === 'synthesis' && (
          <SynthesisTab
            product={{ id: product.id, name: product.name }}
            routes={routes}
            whereUsed={whereUsed}
            canEdit={canEditRoutes}
            catalogue={catalogue}
          />
        )}
        {activeTab === 'documents' && <DocumentsTab documents={documents} />}
        {activeTab === 'history' && <HistoryTab history={history} product={product} />}
        {activeTab === 'analytics' && <AnalyticsTab companies={companies} />}
      </div>
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────────────── */

function OverviewTab({
  product,
  companies,
}: {
  product: Awaited<ReturnType<typeof repo.getProduct>> & object;
  companies: Awaited<ReturnType<typeof repo.getProductCompanies>>;
}) {
  const locations = new Set(companies.map((c) => c.company.locationName));
  const totalStaff = companies.reduce((sum, c) => sum + c.company.chemicalStaff, 0);
  const totalPhd = companies.reduce((sum, c) => sum + c.company.phdCount, 0);

  return (
    <Stack gap={16}>
      <div className="astra-grid astra-grid--stats">
        <StatCard label="Companies" value={companies.length} icon={<Building2 size={16} />} tone="primary" caption="able to supply" />
        <StatCard label="Locations" value={locations.size} icon={<MapPin size={16} />} tone="secondary" caption="distinct sites" />
        <StatCard label="Chemical staff" value={formatNumber(totalStaff)} icon={<FlaskConical size={16} />} tone="accent" caption="combined" />
        <StatCard label="PhD chemists" value={formatNumber(totalPhd)} icon={<Activity size={16} />} tone="info" caption="combined" />
      </div>

      <div className="astra-grid astra-grid--2">
        <Card padding="md">
          <CardHeader title="Product details" subtitle="Identity and classification" />
          <DescriptionList>
            <DescriptionItem term="Product name">{product.name}</DescriptionItem>
            <DescriptionItem term="CAS number">
              <span className="astra-table__mono">{product.casNumber}</span>
            </DescriptionItem>
            <DescriptionItem term="Molecular formula">
              <span className="astra-table__mono">{orDash(product.molecularFormula)}</span>
            </DescriptionItem>
            <DescriptionItem term="Molecular weight">
              {product.molecularWeight ? `${product.molecularWeight} g/mol` : '—'}
            </DescriptionItem>
            <DescriptionItem term="Application">{product.applicationName}</DescriptionItem>
            <DescriptionItem term="Category">{product.categoryName}</DescriptionItem>
            <DescriptionItem term="Status">
              <Badge tone={statusTone(product.status)} size="sm" dot>
                {product.status}
              </Badge>
            </DescriptionItem>
            <DescriptionItem term="Created">{formatDate(product.createdAt)}</DescriptionItem>
            <DescriptionItem term="Modified">
              {formatDate(product.updatedAt)} · {formatRelative(product.updatedAt)}
            </DescriptionItem>
          </DescriptionList>

          {product.synonyms.length > 0 && (
            <>
              <div style={{ margin: 'var(--vbds-space-20) 0 var(--vbds-space-12)' }}>
                <Divider label="Synonyms and trade names" />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {product.synonyms.map((synonym) => (
                  <Badge key={synonym} tone="info" size="sm">
                    {synonym}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </Card>

        <Stack gap={16}>
        <Card padding="md">
          <CardHeader
            title="Chemical structure"
            subtitle={
              product.categoryId === 'cat-formulation' ? 'Active substance of this formulation' : 'Recorded structure and identifiers'
            }
          />
          {product.smiles ? (
            <div className="astra-structure-panel">
              <StructureImage smiles={product.smiles} name={product.name} size="md" />
              <DescriptionList>
                <DescriptionItem term="SMILES">
                  <span className="astra-table__mono astra-break-all">{product.smiles}</span>
                </DescriptionItem>
                <DescriptionItem term="InChIKey">
                  <span className="astra-table__mono astra-break-all">{orDash(product.inchiKey)}</span>
                </DescriptionItem>
              </DescriptionList>
            </div>
          ) : (
            <EmptyState
              size="sm"
              icon={<FlaskConical size={20} />}
              title="No structure recorded"
              description="Add a SMILES string from the edit page to show the structure and enable structure search."
            />
          )}
        </Card>

        <Card padding="md">
          <CardHeader title="Description" subtitle="What it is and where it is used" />
          {product.description ? (
            <p style={{ color: 'var(--vbds-text-secondary)', lineHeight: 'var(--vbds-body-line)' }}>
              {product.description}
            </p>
          ) : (
            <p style={{ color: 'var(--vbds-text-tertiary)' }}>No description recorded.</p>
          )}

          {companies.length > 0 && (
            <>
              <div style={{ margin: 'var(--vbds-space-20) 0 var(--vbds-space-12)' }}>
                <Divider label="Supplying companies" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {companies.slice(0, 6).map((row) => (
                  <Link key={row.linkId} href={`/companies/${row.company.slug}`} className="vbds-list-item">
                    <span className="vbds-list-item__leading-icon" aria-hidden="true">
                      <Building2 size={14} />
                    </span>
                    <span className="vbds-list-item__main">
                      <span className="vbds-list-item__title">{row.company.name}</span>
                      <span className="vbds-list-item__subtitle">
                        {row.company.locationName} · {row.productCodes.join(', ')}
                      </span>
                    </span>
                    <span className="vbds-list-item__trailing">
                      <Badge size="sm" tone={statusTone(row.status)}>
                        {row.status}
                      </Badge>
                    </span>
                  </Link>
                ))}
                {companies.length > 6 && (
                  <Link
                    href={`/products/${product.slug}?tab=companies`}
                    style={{
                      fontSize: 'var(--vbds-caption-size)',
                      color: 'var(--vbds-primary)',
                      padding: '8px 12px',
                      fontWeight: 600,
                    }}
                  >
                    View all {companies.length} companies →
                  </Link>
                )}
              </div>
            </>
          )}
        </Card>
        </Stack>
      </div>
    </Stack>
  );
}

/* ── Documents ──────────────────────────────────────────────────── */

function DocumentsTab({ documents }: { documents: Awaited<ReturnType<typeof repo.listDocuments>> }) {
  if (documents.length === 0) {
    return (
      <Card padding="md">
        <EmptyState
          icon={<FileText size={22} />}
          title="No documents yet"
          description="Certificates of analysis, safety data sheets and spec sheets attached to this product will appear here."
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
              <th>Document</th>
              <th>Type</th>
              <th>Version</th>
              <th>Size</th>
              <th>Uploaded by</th>
              <th>Date</th>
              <th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td title={doc.name}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={14} style={{ color: 'var(--vbds-text-tertiary)' }} aria-hidden="true" />
                    {doc.name}
                  </span>
                </td>
                <td>
                  <Badge size="sm" tone="info">
                    {doc.kind}
                  </Badge>
                </td>
                <td className="astra-table__num">v{doc.version}</td>
                <td className="astra-table__num">{formatNumber(doc.sizeKb)} KB</td>
                <td>{doc.uploadedByName}</td>
                <td>{formatDate(doc.createdAt)}</td>
                <td>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--vbds-text-tertiary)',
                      fontSize: 'var(--vbds-caption-size)',
                    }}
                    title="Document storage is not wired to a bucket in this build"
                  >
                    <Download size={13} aria-hidden="true" />
                    —
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── History ────────────────────────────────────────────────────── */

function HistoryTab({
  history,
  product,
}: {
  history: Awaited<ReturnType<typeof repo.listEntityAuditLogs>>;
  product: { createdAt: string; name: string };
}) {
  return (
    <Card padding="md">
      <CardHeader title="Change history" subtitle="Every recorded change to this product, most recent first" />

      <div className="astra-timeline">
        {history.map((entry) => (
          <div className="astra-timeline__item" key={entry.id}>
            <span
              className={`astra-timeline__dot astra-timeline__dot--${
                entry.action === 'CREATE' ? 'create' : entry.action === 'DELETE' ? 'delete' : 'update'
              }`}
              aria-hidden="true"
            >
              <Activity size={13} />
            </span>
            <div className="astra-timeline__main">
              <div className="astra-timeline__title">{entry.summary}</div>
              {entry.changes && (
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(entry.changes).map(([field, change]) => (
                    <Badge key={field} size="sm">
                      {field}: {String(change.from)} → {String(change.to)}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="astra-timeline__meta">
                {entry.actorName} · {formatDateTime(entry.createdAt)} · {formatRelative(entry.createdAt)}
              </div>
            </div>
          </div>
        ))}

        <div className="astra-timeline__item">
          <span className="astra-timeline__dot astra-timeline__dot--create" aria-hidden="true">
            <FlaskConical size={13} />
          </span>
          <div className="astra-timeline__main">
            <div className="astra-timeline__title">{product.name} added to the catalogue</div>
            <div className="astra-timeline__meta">{formatDateTime(product.createdAt)}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── Analytics ──────────────────────────────────────────────────── */

function AnalyticsTab({ companies }: { companies: Awaited<ReturnType<typeof repo.getProductCompanies>> }) {
  if (companies.length === 0) {
    return (
      <Card padding="md">
        <EmptyState
          icon={<ChartNoAxesColumn size={22} />}
          title="Nothing to analyse yet"
          description="Attach companies to this product and the supply-base analytics will populate."
        />
      </Card>
    );
  }

  const byLocation = new Map<string, number>();
  for (const row of companies) {
    byLocation.set(row.company.locationName, (byLocation.get(row.company.locationName) ?? 0) + 1);
  }

  const capabilityCoverage = EQUIPMENT_MASTER.map((eq) => ({
    key: eq.key,
    label: eq.name,
    value: companies.filter((c) => c.equipment[eq.key]?.available).length,
  }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const staffBands = companies
    .map((c) => ({ key: c.company.id, label: c.company.name, value: c.company.chemicalStaff }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="astra-grid astra-grid--2">
      <ChartCard
        title="Supply base by location"
        subtitle="Where this product can be made"
        valueLabel="Companies"
        data={Array.from(byLocation, ([label, value]) => ({ key: label, label, value })).sort(
          (a, b) => b.value - a.value,
        )}
      >
        <MagnitudeBars
          data={Array.from(byLocation, ([label, value]) => ({ key: label, label, value })).sort(
            (a, b) => b.value - a.value,
          )}
          unit="companies"
        />
      </ChartCard>

      <ChartCard
        title="Capability coverage"
        subtitle="How many of these suppliers have each capability"
        valueLabel="Companies"
        data={capabilityCoverage}
      >
        <MagnitudeBars data={capabilityCoverage} limit={10} unit="of the supply base" />
      </ChartCard>

      <ChartCard
        title="Chemical staff by supplier"
        subtitle="Relative scale of each supplier's chemistry team"
        valueLabel="Staff"
        data={staffBands}
      >
        <MagnitudeBars data={staffBands} limit={10} unit="staff" />
      </ChartCard>

      <ChartCard
        title="PhD depth by supplier"
        subtitle="Doctorate-level chemists on staff"
        valueLabel="PhD"
        data={companies
          .map((c) => ({ key: c.company.id, label: c.company.name, value: c.company.phdCount }))
          .sort((a, b) => b.value - a.value)}
      >
        <MagnitudeBars
          data={companies
            .map((c) => ({ key: c.company.id, label: c.company.name, value: c.company.phdCount }))
            .sort((a, b) => b.value - a.value)}
          limit={10}
          unit="PhD"
        />
      </ChartCard>
    </div>
  );
}
