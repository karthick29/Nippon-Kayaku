/* ════════════════════════════════════════════════════════════════════
   Chart theme.

   The palette is validated (dataviz validator, both modes) and lives in
   src/styles/tokens.css. Rules encoded here:

     · Categorical hues are assigned in FIXED ORDER, never cycled. A 9th
       series folds into "Other" — see `assignSeries`.
     · All-pairs forms (donut, scatter) are capped at ALL_PAIRS_CAP = 3;
       only the first three slots clear the all-pairs floors in both
       modes. Magnitude comparisons use a single hue instead.
     · Light-mode slots 3, 4 and 5 sit below 3:1 contrast on the light
       surface, so every chart ships visible value labels AND a table
       view — that is the documented relief, not an optional extra.
     · Never a dual axis. Two measures of different scale become two
       charts or an indexed series.
   ════════════════════════════════════════════════════════════════════ */

/** Fixed categorical order. Reference by index; never rotate. */
export const SERIES = [
  'var(--vbds-chart-1)',
  'var(--vbds-chart-2)',
  'var(--vbds-chart-3)',
  'var(--vbds-chart-4)',
  'var(--vbds-chart-5)',
  'var(--vbds-chart-6)',
  'var(--vbds-chart-7)',
  'var(--vbds-chart-8)',
] as const;

/** Single hue for magnitude (sequential) work. */
export const SEQUENTIAL = 'var(--vbds-chart-1)';
export const SEQUENTIAL_MUTED = 'var(--vbds-primary-subtle)';

export const GRID = 'var(--vbds-chart-grid)';
export const AXIS = 'var(--vbds-chart-axis)';
export const SURFACE = 'var(--vbds-surface)';
export const INK = 'var(--vbds-text)';
export const INK_MUTED = 'var(--vbds-text-secondary)';

/** Max series before an all-pairs form (donut, scatter) stops being legible. */
export const ALL_PAIRS_CAP = 3;

/** Max series in an adjacent-pairlist form (bar, line, stacked). */
export const ADJACENT_CAP = 8;

export function seriesColor(index: number): string {
  return SERIES[index % SERIES.length]!;
}

/**
 * Caps a series list at the palette size and folds the tail into a
 * single "Other" bucket, so a hue is never generated or reused.
 */
export function assignSeries<T extends { value: number }>(
  items: T[],
  cap: number = ADJACENT_CAP,
): Array<T & { color: string }> {
  if (items.length <= cap) {
    return items.map((item, i) => ({ ...item, color: seriesColor(i) }));
  }

  const head = items.slice(0, cap - 1).map((item, i) => ({ ...item, color: seriesColor(i) }));
  const tail = items.slice(cap - 1);
  const other = {
    ...tail[0]!,
    label: `Other (${tail.length})`,
    key: '__other__',
    value: tail.reduce((sum, t) => sum + t.value, 0),
    color: 'var(--vbds-text-tertiary)',
  } as T & { color: string };

  return [...head, other];
}

/** Recharts axis tick styling — recessive by design. */
export const axisTick = {
  fill: 'var(--vbds-text-secondary)',
  fontSize: 11,
  fontFamily: 'var(--vbds-font)',
} as const;

export const axisLine = { stroke: GRID } as const;

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

/* ── Drill-down helpers ─────────────────────────────────────────── */

interface Bucket {
  key: string;
  label: string;
  value: number;
  href?: string;
}

/**
 * Attaches a drill-down href to each bucket by appending its key to a
 * base path. Server components call this before handing data to a chart:
 * a callback prop cannot cross the Server→Client boundary, so the link
 * has to be part of the serialized data.
 */
export function withHref<T extends Bucket>(buckets: T[], base: string): T[] {
  return buckets.map((b) => ({ ...b, href: `${base}${encodeURIComponent(b.key)}` }));
}

/** Company buckets link by name, since the list page searches by text. */
export function withCompanyHref<T extends Bucket>(buckets: T[]): T[] {
  return buckets.map((b) => ({ ...b, href: `/companies?q=${encodeURIComponent(b.label)}` }));
}

export function formatPercent(value: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}
