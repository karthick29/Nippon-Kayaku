import type { CSSProperties } from 'react';
import { cx } from '@/lib/cn';

/* ════════════════════════════════════════════════════════════════════
   Ported from designsystem/src/components/{Spinner,ProgressBar,
   Skeleton}.tsx — unchanged apart from density-scaled sizes.
   ════════════════════════════════════════════════════════════════════ */

export function Spinner({
  size = 'md',
  className,
  label = 'Loading',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cx('vbds-spinner', size !== 'md' && `vbds-spinner--${size}`, className)}
      role="status"
      aria-label={label}
    />
  );
}

export function ProgressBar({
  value,
  tone = 'primary',
  thin,
  className,
  label,
}: {
  /** 0–100. */
  value: number;
  tone?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger';
  thin?: boolean;
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cx('vbds-progress', tone !== 'primary' && `vbds-progress--${tone}`, thin && 'vbds-progress--thin', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="vbds-progress__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Skeleton({
  variant = 'rect',
  width,
  height,
  className,
  style,
}: {
  variant?: 'text' | 'rect' | 'circle';
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx('vbds-skeleton', variant !== 'rect' && `vbds-skeleton--${variant}`, className)}
      aria-hidden="true"
      style={{
        width: width ?? (variant === 'text' ? '100%' : 40),
        height: height ?? (variant === 'circle' ? (width ?? 40) : variant === 'text' ? undefined : 40),
        ...style,
      }}
    />
  );
}

/** Skeleton composition mirroring the enterprise data table layout. */
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="astra-table-wrap">
      <div className="astra-table-toolbar">
        <Skeleton width={240} height={32} />
        <div style={{ flex: 1 }} />
        <Skeleton width={90} height={32} />
        <Skeleton width={90} height={32} />
      </div>
      <div style={{ padding: 'var(--vbds-space-12) var(--vbds-space-16)' }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: 'var(--vbds-space-16)',
              padding: 'var(--vbds-space-12) 0',
            }}
          >
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} variant="text" width={c === 0 ? '80%' : `${45 + ((r + c) % 4) * 12}%`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton composition mirroring a row of StatCards. */
export function StatGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="astra-grid astra-grid--stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="vbds-card vbds-card--pad-md">
          <Skeleton variant="text" width="55%" />
          <div style={{ height: 12 }} />
          <Skeleton width="45%" height={28} />
          <div style={{ height: 8 }} />
          <Skeleton variant="text" width="35%" />
        </div>
      ))}
    </div>
  );
}
