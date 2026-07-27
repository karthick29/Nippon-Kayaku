import type { Metadata } from 'next';
import { Badge, Card, CardHeader, LinkTabs } from '@/components/vbds';
import { APPLICATIONS, CATEGORIES, EQUIPMENT_MASTER, LOCATIONS } from '@/data/masters';
import { PRODUCT_STATUSES } from '@/lib/types';
import { statusTone } from '@/lib/status';
import { repo } from '@/server/repo';

export const metadata: Metadata = { title: 'Master Data · Settings' };
export const dynamic = 'force-dynamic';

const TABS = [
  { value: 'applications', label: 'Applications' },
  { value: 'locations', label: 'Locations' },
  { value: 'statuses', label: 'Statuses' },
  { value: 'categories', label: 'Categories' },
  { value: 'equipment', label: 'Equipment' },
];

type SearchParams = Promise<{ tab?: string }>;

export default async function MasterDataPage({ searchParams }: { searchParams: SearchParams }) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.value === tab) ? tab! : 'applications';

  // Fetched once for the whole page — an async cell component would
  // re-query per row.
  const [products, companies, coverage] = await Promise.all([
    repo.allProducts(),
    repo.allCompanies(),
    repo.equipmentCoverage(),
  ]);
  const coverageByKey = new Map(coverage.map((c) => [c.key as string, c]));

  const usage = {
    application: (id: string) => products.filter((p) => p.applicationId === id).length,
    category: (id: string) => products.filter((p) => p.categoryId === id).length,
    location: (id: string) => companies.filter((c) => c.locationId === id).length,
    status: (s: string) => products.filter((p) => p.status === s).length,
  };

  return (
    <Card padding="none">
      <div style={{ padding: 'var(--vbds-space-20) var(--vbds-space-20) 0' }}>
        <CardHeader
          title="Master data"
          subtitle="The reference lists behind every picker, filter and chart. The usage column shows how many records depend on each entry — anything in use cannot be deleted."
        />
        <LinkTabs
          ariaLabel="Master data sets"
          activeValue={active}
          tabs={TABS.map((t) => ({
            ...t,
            href: `/settings/master-data?tab=${t.value}`,
            count:
              t.value === 'applications'
                ? APPLICATIONS.length
                : t.value === 'locations'
                  ? LOCATIONS.length
                  : t.value === 'statuses'
                    ? PRODUCT_STATUSES.length
                    : t.value === 'categories'
                      ? CATEGORIES.length
                      : EQUIPMENT_MASTER.length,
          }))}
        />
      </div>

      <div className="astra-scroll-x">
        {active === 'applications' && (
          <table className="astra-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Products</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {APPLICATIONS.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 550 }}>{item.name}</td>
                  <td className="astra-table__mono">{item.slug}</td>
                  <td title={item.description}>{item.description}</td>
                  <td className="astra-table__num">{usage.application(item.id)}</td>
                  <td>
                    <Badge tone={item.active ? 'success' : 'neutral'} size="sm" dot>
                      {item.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {active === 'locations' && (
          <table className="astra-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>State</th>
                <th>Country</th>
                <th>Region</th>
                <th>Companies</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {LOCATIONS.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 550 }}>{item.name}</td>
                  <td>{item.state}</td>
                  <td>{item.country}</td>
                  <td>{item.region}</td>
                  <td className="astra-table__num">{usage.location(item.id)}</td>
                  <td>
                    <Badge tone={item.active ? 'success' : 'neutral'} size="sm" dot>
                      {item.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {active === 'statuses' && (
          <table className="astra-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Badge</th>
                <th>Meaning</th>
                <th>Products</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCT_STATUSES.map((status) => (
                <tr key={status}>
                  <td style={{ fontWeight: 550 }}>{status}</td>
                  <td>
                    <Badge tone={statusTone(status)} size="sm" dot>
                      {status}
                    </Badge>
                  </td>
                  <td>
                    {status === 'Commercial'
                      ? 'Validated and sellable at scale.'
                      : status === 'Development'
                        ? 'Route under development; not yet offered commercially.'
                        : status === 'Pilot'
                          ? 'Scale-up campaign under way.'
                          : 'Withdrawn — kept for history and regulatory traceability.'}
                  </td>
                  <td className="astra-table__num">{usage.status(status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {active === 'categories' && (
          <table className="astra-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Products</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 550 }}>{item.name}</td>
                  <td className="astra-table__mono">{item.slug}</td>
                  <td>{item.description}</td>
                  <td className="astra-table__num">{usage.category(item.id)}</td>
                  <td>
                    <Badge tone={item.active ? 'success' : 'neutral'} size="sm" dot>
                      {item.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {active === 'equipment' && (
          <table className="astra-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Key</th>
                <th>Group</th>
                <th>Value type</th>
                <th>Unit</th>
                <th>Companies with it</th>
              </tr>
            </thead>
            <tbody>
              {EQUIPMENT_MASTER.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 550 }}>{item.name}</td>
                  <td className="astra-table__mono">{item.key}</td>
                  <td>
                    <Badge size="sm">{item.group}</Badge>
                  </td>
                  <td>{item.valueType}</td>
                  <td>{item.unit ?? '—'}</td>
                  <td className="astra-table__num">
                    {coverageByKey.has(item.key)
                      ? `${coverageByKey.get(item.key)!.companies} (${coverageByKey.get(item.key)!.pct}%)`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
