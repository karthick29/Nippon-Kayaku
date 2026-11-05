import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Building2, FlaskConical } from 'lucide-react';
import type { ProductRow } from '@/lib/types';
import { Avatar, Badge, Button } from '@/components/vbds';
import { statusTone } from '@/lib/status';
import { cx } from '@/lib/cn';
import { Highlight } from './Highlight';

/**
 * Search result card — the unit of the Search Chemicals page.
 * Shows exactly what the brief calls for: name, CAS, application,
 * status, which companies can supply it, and a way in.
 */
export function ProductResultCard({
  product,
  query,
  view = 'grid',
  structure,
  matchLabel,
}: {
  product: ProductRow;
  query?: string;
  view?: 'grid' | 'list';
  /** Structure search: the depiction, with matched atoms highlighted. */
  structure?: ReactNode;
  /** Structure search: why this matched, e.g. "Similarity 82%". */
  matchLabel?: string;
}) {
  const shown = product.companies.slice(0, 4);
  const extra = product.companyCount - shown.length;

  return (
    <article className={cx('astra-result', view === 'list' && 'astra-result--list')}>
      {structure && <div className="astra-result__structure">{structure}</div>}
      <div className="astra-result__top">
        <span className="astra-result__glyph" aria-hidden="true">
          <FlaskConical size={17} />
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <Link href={`/products/${product.slug}`} className="astra-result__name">
            <Highlight text={product.name} query={query} />
          </Link>
          <div className="astra-result__cas">
            CAS <Highlight text={product.casNumber} query={query} />
            {product.molecularFormula && <> · {product.molecularFormula}</>}
          </div>
        </div>

        <Badge tone={statusTone(product.status)} size="sm" dot>
          {product.status}
        </Badge>
      </div>

      <div className="astra-result__meta">
        {matchLabel && (
          <Badge tone="success" size="sm">
            {matchLabel}
          </Badge>
        )}
        <Badge tone="primary" size="sm">
          {product.applicationName}
        </Badge>
        <Badge size="sm">{product.categoryName}</Badge>
        {product.synonyms.length > 0 && (
          <span
            style={{ fontSize: 'var(--vbds-caption-size)', color: 'var(--vbds-text-tertiary)' }}
            title={product.synonyms.join(', ')}
          >
            aka <Highlight text={product.synonyms[0]!} query={query} />
            {product.synonyms.length > 1 && ` +${product.synonyms.length - 1}`}
          </span>
        )}
      </div>

      <div className="astra-result__companies">
        {product.companyCount === 0 ? (
          <span style={{ color: 'var(--vbds-text-tertiary)' }}>
            <Building2 size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 5 }} />
            No supplier mapped yet
          </span>
        ) : (
          <>
            <span className="astra-result__avatars" aria-hidden="true">
              {shown.map((company) => (
                <Avatar key={company.id} name={company.name} size="sm" title={company.name} />
              ))}
            </span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {product.companyCount} {product.companyCount === 1 ? 'company' : 'companies'}
              {extra > 0 ? ` · ${shown.map((c) => c.name).join(', ')} +${extra}` : ` · ${shown.map((c) => c.name).join(', ')}`}
            </span>
          </>
        )}

        <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <Button
            variant="text"
            size="sm"
            href={`/products/${product.slug}`}
            trailingIcon={<ArrowRight size={13} />}
          >
            View Details
          </Button>
        </span>
      </div>
    </article>
  );
}
