'use client';

import Link from 'next/link';
import { cx } from '@/lib/cn';
import { formatNumber } from './chart-theme';
import type { ChartDatum } from './ChartCard';

/* ════════════════════════════════════════════════════════════════════
   Horizontal magnitude bars.

   Form choice: the job is "compare magnitudes across named categories",
   so this is a ranked horizontal bar — not a donut. Identity comes from
   the row label, so the encoding is single-hue sequential and no
   categorical palette slot is consumed. Every bar carries a direct value
   label, which is also the light-mode contrast relief.

   Marks: 4px rounded data-end, bar anchored to a zero baseline at the
   left, recessive track, 2px gap between rows.
   ════════════════════════════════════════════════════════════════════ */

export interface MagnitudeBarsProps {
  data: ChartDatum[];
  /** Maximum rows to render; the rest are summarised in the footer. */
  limit?: number;
  /** Suffix after the value, e.g. "companies". */
  unit?: string;
  /** Show the value as a share of the total instead of a raw count. */
  asPercent?: boolean;
  className?: string;
}

export function MagnitudeBars({ data, limit = 10, unit, asPercent, className }: MagnitudeBarsProps) {
  const rows = data.slice(0, limit);
  const hidden = data.length - rows.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className={cx('astra-bars', className)} role="presentation">
      {rows.map((d) => {
        const pct = (d.value / max) * 100;
        const href = d.href;
        const label = (
          <span className="astra-bars__label" title={d.label}>
            {d.label}
          </span>
        );

        return (
          <div className="astra-bars__row" key={d.key}>
            <div className="astra-bars__head">
              {href ? (
                <Link href={href} className="astra-bars__link">
                  {label}
                </Link>
              ) : (
                label
              )}
              <span className="astra-bars__value">
                {asPercent ? `${Math.round((d.value / (total || 1)) * 100)}%` : formatNumber(d.value)}
                {unit && <span className="astra-bars__unit"> {unit}</span>}
              </span>
            </div>
            <div className="astra-bars__track">
              <div
                className="astra-bars__fill"
                style={{ width: `${Math.max(pct, 1.5)}%`, background: d.color ?? 'var(--vbds-chart-1)' }}
              />
            </div>
          </div>
        );
      })}

      {hidden > 0 && (
        <p className="astra-bars__more">
          + {hidden} more {hidden === 1 ? 'row' : 'rows'} — open the data table for the full list
        </p>
      )}
    </div>
  );
}
