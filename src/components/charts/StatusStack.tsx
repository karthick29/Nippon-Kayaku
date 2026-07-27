'use client';

import { seriesColor, formatNumber } from './chart-theme';
import type { ChartDatum } from './ChartCard';

/* ════════════════════════════════════════════════════════════════════
   Composition of a whole — a single 100% stacked bar.

   Chosen over a donut deliberately. A donut puts every slice adjacent to
   every other (the "all pairs" case), where only three palette slots
   clear the CVD floors. A stacked bar only ever places neighbours side
   by side, which the eight-slot palette passes, and it reads shares more
   accurately than angle does.

   Marks: 2px surface gap between segments, 4px rounded outer ends,
   direct labels below rather than inside so small segments stay legible.
   ════════════════════════════════════════════════════════════════════ */

export function StatusStack({ data }: { data: ChartDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const segments = data.map((d, i) => ({ ...d, color: d.color ?? seriesColor(i) }));

  return (
    <div>
      <div className="astra-stack" aria-hidden="true">
        {segments.map((d) => (
          <div
            key={d.key}
            className="astra-stack__seg"
            style={{ flexGrow: d.value, background: d.color }}
            title={`${d.label}: ${d.value}`}
          />
        ))}
      </div>

      <ul className="astra-stack__legend">
        {segments.map((d) => (
          <li className="astra-stack__legend-item" key={d.key}>
            <span className="astra-legend__swatch" style={{ background: d.color }} aria-hidden="true" />
            <span className="astra-stack__legend-label">{d.label}</span>
            <span className="astra-stack__legend-value">
              {formatNumber(d.value)}
              <span className="astra-stack__legend-pct">{Math.round((d.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
