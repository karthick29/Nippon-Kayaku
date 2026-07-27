'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { AXIS, GRID, SERIES, axisTick, formatNumber } from './chart-theme';

/* ════════════════════════════════════════════════════════════════════
   Change-over-time — line chart, one shared y-axis.

   Two series (products, companies) counted in the same unit, so a single
   axis is correct. Never a second y-scale: a dual axis makes any two
   series look correlated by construction.

   Marks: 2px strokes, 8px active dots, recessive horizontal-only grid,
   crosshair tooltip on hover.
   ════════════════════════════════════════════════════════════════════ */

export interface TrendPoint {
  month: string;
  products: number;
  companies: number;
}

function TrendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="astra-chart-tooltip">
      <div className="astra-chart-tooltip__label">{label}</div>
      {payload.map((entry) => (
        <div className="astra-chart-tooltip__row" key={entry.dataKey as string}>
          <span className="astra-chart-tooltip__swatch" style={{ background: entry.color }} />
          {entry.name}
          <span className="astra-chart-tooltip__value">{formatNumber(Number(entry.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  return (
    <div aria-hidden="true">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} dy={4} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '4 4' }} />
          <Line
            type="monotone"
            dataKey="products"
            name="Products added"
            stroke={SERIES[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--vbds-surface)' }}
          />
          <Line
            type="monotone"
            dataKey="companies"
            name="Companies added"
            stroke={SERIES[1]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--vbds-surface)' }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend is always present for ≥2 series — identity is never colour alone. */}
      <div className="astra-legend">
        <span className="astra-legend__item">
          <span className="astra-legend__swatch" style={{ background: SERIES[0] }} />
          Products added
        </span>
        <span className="astra-legend__item">
          <span className="astra-legend__swatch" style={{ background: SERIES[1] }} />
          Companies added
        </span>
      </div>
    </div>
  );
}
