import Link from 'next/link';
import { GitBranch, Route as RouteIcon, TriangleAlert } from 'lucide-react';
import { StructureImage } from '@/components/chem/StructureImage';
import { Stack } from '@/components/page/PageHeader';
import { Badge, Card, CardHeader, EmptyState } from '@/components/vbds';
import { formatDate, orDash } from '@/lib/format';
import { statusTone } from '@/lib/status';
import { ROUTE_ROLE_LABELS, supplyRisk } from '@/lib/synthesis';
import type { ProductSummary, RouteInputView, SynthesisRouteView, WhereUsedEntry } from '@/lib/types';
import { AddRouteButton, RouteActions, type CatalogueOption } from './RouteEditor';

/* ════════════════════════════════════════════════════════════════════
   Synthesis tab — "Made from" (this product's routes) and "Used in"
   (everything made from it, directly or through intermediates).

   The supply signal comes from data ASTRA already has: a catalogue
   input's mapped supplier count. One supplier means one failure stops
   the route — the question this tab exists to answer.
   ════════════════════════════════════════════════════════════════════ */

export function SynthesisTab({
  product,
  routes,
  whereUsed,
  canEdit,
  catalogue,
}: {
  product: { id: string; name: string };
  routes: SynthesisRouteView[];
  whereUsed: WhereUsedEntry[];
  canEdit: boolean;
  catalogue: CatalogueOption[];
}) {
  const preferred = routes.find((r) => r.isPreferred) ?? routes[0];
  const atRisk = (preferred?.inputs ?? []).filter(
    (input) => input.product && !input.product.deleted && supplyRisk(input.product.companyCount) !== 'covered',
  );

  return (
    <Stack gap={16}>
      {atRisk.length > 0 && (
        <div className="astra-callout astra-callout--warning" role="status">
          <TriangleAlert size={16} aria-hidden="true" />
          <p>
            <strong>Supply risk on the preferred route.</strong>{' '}
            {atRisk.map((input, i) => (
              <span key={input.id}>
                {i > 0 && (i === atRisk.length - 1 ? ' and ' : ', ')}
                <Link href={`/products/${input.product!.slug}?tab=companies`}>{input.product!.name}</Link> (
                {input.product!.companyCount === 0 ? 'no mapped supplier' : 'single supplier'})
              </span>
            ))}{' '}
            — {atRisk.some((i) => i.product!.companyCount === 0) ? 'production of' : 'one supplier failing would stop production of'}{' '}
            {product.name}
            {atRisk.some((i) => i.product!.companyCount === 0) ? ' has no secured source today.' : '.'}
          </p>
        </div>
      )}

      <Card padding="md">
        <CardHeader
          title="Made from"
          subtitle={`How ${product.name} is synthesised${routes.length > 1 ? ` — ${routes.length} routes, preferred first` : ''}`}
          action={
            canEdit ? (
              <AddRouteButton
                productId={product.id}
                productName={product.name}
                catalogue={catalogue}
                isFirstRoute={routes.length === 0}
              />
            ) : undefined
          }
        />
        {routes.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<RouteIcon size={20} />}
            title="No synthesis route recorded"
            description={
              canEdit
                ? 'Add a route to record the building blocks, reagents and catalysts this product is made from.'
                : 'No one has recorded how this product is made yet.'
            }
          />
        ) : (
          <Stack gap={16}>
            {routes.map((route) => (
              <RouteCard key={route.id} route={route} product={product} canEdit={canEdit} catalogue={catalogue} />
            ))}
          </Stack>
        )}
      </Card>

      <Card padding="md">
        <CardHeader
          title="Used in"
          subtitle={`Products made from ${product.name}, directly or through intermediates`}
        />
        {whereUsed.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<GitBranch size={20} />}
            title="Not used to make any recorded product"
            description={`When a synthesis route lists ${product.name} as an input, that product appears here — including anything made from it in later steps.`}
          />
        ) : (
          <WhereUsedTable entries={whereUsed} />
        )}
      </Card>
    </Stack>
  );
}

/* ── Made from ──────────────────────────────────────────────────── */

function RouteCard({
  route,
  product,
  canEdit,
  catalogue,
}: {
  route: SynthesisRouteView;
  product: { id: string; name: string };
  canEdit: boolean;
  catalogue: CatalogueOption[];
}) {
  const titleId = `route-${route.id}`;
  return (
    <section className="astra-route-card" aria-labelledby={titleId}>
      <header className="astra-route-card__header">
        <div style={{ minWidth: 0 }}>
          <h4 id={titleId} className="astra-route-card__title">
            {route.name}
          </h4>
          <div className="astra-route-card__meta">
            {route.isPreferred && (
              <Badge tone="primary" size="sm">
                Preferred
              </Badge>
            )}
            {route.reviewStatus === 'reviewed' ? (
              <Badge tone="success" size="sm" dot>
                Reviewed
              </Badge>
            ) : (
              <Badge tone="warning" size="sm" dot>
                Awaiting chemist review
              </Badge>
            )}
            <span>
              {route.inputs.length} {route.inputs.length === 1 ? 'input' : 'inputs'} · updated {formatDate(route.updatedAt)}
            </span>
          </div>
        </div>
        {canEdit && <RouteActions route={route} productId={product.id} productName={product.name} catalogue={catalogue} />}
      </header>

      {route.notes && <p className="astra-route-card__notes">{route.notes}</p>}

      <div className="astra-scroll-x">
        <table className="astra-table astra-table--wrap">
          <caption className="astra-sr-only">Inputs to {route.name}</caption>
          <thead>
            <tr>
              <th style={{ width: 136 }}>Structure</th>
              <th style={{ minWidth: 260 }}>Input</th>
              <th>CAS number</th>
              <th>Role</th>
              <th>Supply</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {route.inputs.map((input) => (
              <InputRow key={input.id} input={input} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InputRow({ input }: { input: RouteInputView }) {
  const name = input.product?.name ?? input.externalName ?? 'Unnamed input';
  return (
    <tr>
      <td>
        <StructureImage smiles={input.product?.smiles ?? input.externalSmiles} name={name} size="xs" />
      </td>
      <td>
        <span className="astra-route-input__name">
          {input.product ? <Link className="astra-table__link" href={`/products/${input.product.slug}`}>{input.product.name}</Link> : name}
          {input.product ? (
            input.product.deleted ? (
              <Badge tone="danger" size="sm">
                Removed from catalogue
              </Badge>
            ) : (
              <Badge tone="info" size="sm">
                Catalogue
              </Badge>
            )
          ) : (
            <Badge size="sm">External</Badge>
          )}
        </span>
      </td>
      <td className="astra-table__mono">{orDash(input.product?.casNumber ?? input.externalCas)}</td>
      <td>
        <Badge size="sm">{ROUTE_ROLE_LABELS[input.role]}</Badge>
      </td>
      <td>{input.product ? <SupplyBadge product={input.product} /> : <span className="astra-muted">Not tracked</span>}</td>
      <td>{orDash(input.quantity)}</td>
    </tr>
  );
}

function SupplyBadge({ product }: { product: ProductSummary }) {
  const risk = supplyRisk(product.companyCount);
  const label =
    risk === 'none' ? 'No supplier' : risk === 'single' ? 'Single source' : `${product.companyCount} suppliers`;
  return (
    <Link className="astra-plain-link" href={`/products/${product.slug}?tab=companies`} title="See who can supply it">
      <Badge tone={risk === 'none' ? 'danger' : risk === 'single' ? 'warning' : 'success'} size="sm" dot>
        {label}
      </Badge>
    </Link>
  );
}

/* ── Used in ────────────────────────────────────────────────────── */

function WhereUsedTable({ entries }: { entries: WhereUsedEntry[] }) {
  return (
    <div className="astra-scroll-x">
      <table className="astra-table astra-table--wrap">
        <caption className="astra-sr-only">Products made from this product</caption>
        <thead>
          <tr>
            <th style={{ width: 136 }}>Structure</th>
            <th style={{ minWidth: 240 }}>Product</th>
            <th>Link</th>
            <th>Route</th>
            <th>Used as</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.product.id}>
              <td>
                <StructureImage smiles={entry.product.smiles} name={entry.product.name} size="xs" />
              </td>
              <td>
                <Link className="astra-table__link" href={`/products/${entry.product.slug}?tab=synthesis`}>{entry.product.name}</Link>
                <div className="astra-table__mono astra-muted">{entry.product.casNumber}</div>
              </td>
              <td>
                {entry.depth === 1 ? (
                  'Direct input'
                ) : (
                  <span>
                    {entry.depth} steps, via{' '}
                    {entry.via.map((step, i) => (
                      <span key={step.id}>
                        {i > 0 && ' → '}
                        <Link className="astra-table__link" href={`/products/${step.slug}?tab=synthesis`}>{step.name}</Link>
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td>{entry.routeName}</td>
              <td>
                <Badge size="sm">{ROUTE_ROLE_LABELS[entry.role]}</Badge>
              </td>
              <td>
                <Badge tone={statusTone(entry.product.status)} size="sm" dot>
                  {entry.product.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
