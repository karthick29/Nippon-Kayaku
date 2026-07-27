'use client';

import { Table2, BarChart3 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Card, IconButton, Tooltip } from '@/components/vbds';
import { formatNumber } from './chart-theme';

/* ════════════════════════════════════════════════════════════════════
   Chart container.

   Every chart ships a table view. That is not a nicety: three light-mode
   palette slots fall below 3:1 contrast against the surface, and the
   dataviz relief rule requires visible labels or a table for those. The
   table is also the screen-reader path — the SVG is aria-hidden.
   ════════════════════════════════════════════════════════════════════ */

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  color?: string;
  /**
   * Optional drill-down target. A plain string rather than a callback,
   * because chart data crosses the Server→Client component boundary and
   * functions are not serializable across it.
   */
  href?: string;
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Column heading for the value column in the table view. */
  valueLabel?: string;
  data: ChartDatum[];
  action?: ReactNode;
  children: ReactNode;
  /** Rendered instead of the chart when there is no data. */
  empty?: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  valueLabel = 'Count',
  data,
  action,
  children,
  empty,
  className,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const hasData = data.length > 0 && total > 0;

  return (
    <Card className={className} padding="md">
      <div className="vbds-card__header">
        <div style={{ minWidth: 0 }}>
          <h3 className="vbds-card__title">{title}</h3>
          {subtitle && <p className="vbds-card__subtitle">{subtitle}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--vbds-space-4)' }}>
          {action}
          <Tooltip content={showTable ? 'Show chart' : 'Show data table'}>
            <IconButton
              size="sm"
              icon={showTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
              label={showTable ? 'Show chart' : 'Show data table'}
              onClick={() => setShowTable((v) => !v)}
            />
          </Tooltip>
        </div>
      </div>

      {!hasData ? (
        (empty ?? (
          <p style={{ color: 'var(--vbds-text-tertiary)', fontSize: 'var(--vbds-caption-size)', padding: '24px 0' }}>
            No data for this selection.
          </p>
        ))
      ) : showTable ? (
        <div className="astra-scroll-x">
          <table className="astra-table" style={{ fontSize: 'var(--vbds-caption-size)' }}>
            <caption className="astra-sr-only">
              {title} — {subtitle ?? 'data table'}
            </caption>
            <thead>
              <tr>
                <th scope="col">{title}</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  {valueLabel}
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key}>
                  <th scope="row" style={{ fontWeight: 500, textAlign: 'left', whiteSpace: 'normal' }}>
                    {d.label}
                  </th>
                  <td className="astra-table__num">{formatNumber(d.value)}</td>
                  <td className="astra-table__num" style={{ color: 'var(--vbds-text-secondary)' }}>
                    {total ? `${Math.round((d.value / total) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
