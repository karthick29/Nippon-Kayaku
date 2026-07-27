/** Shared display formatting. Locale is fixed to en-GB / en-IN so the
 *  server and client always render the same string (no hydration drift). */

const DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const NUMBER = new Intl.NumberFormat('en-IN');

export function formatDate(iso: string | Date | undefined | null): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return Number.isNaN(date.getTime()) ? '—' : DATE.format(date);
}

export function formatDateTime(iso: string | Date | undefined | null): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME.format(date);
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return NUMBER.format(value);
}

/** "3 days ago" — coarse buckets only; precision here is noise. */
export function formatRelative(iso: string | undefined | null, now = Date.now()): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.round(months / 12)}y ago`;
}

/** Empty-safe display for optional text fields. */
export function orDash(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const text = String(value).trim();
  return text === '' || text.toUpperCase() === 'NA' ? '—' : text;
}
