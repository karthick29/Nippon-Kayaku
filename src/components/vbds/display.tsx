import Link from 'next/link';
import { TrendingDown, TrendingUp, Minus as TrendFlat, Inbox } from 'lucide-react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cn';

/* ════════════════════════════════════════════════════════════════════
   Ported from designsystem/src/components/{Card,StatCard,EmptyState,
   Badge,Chip,Avatar,Divider,ListItem}.tsx

   These are server-safe (no hooks, no event handlers by default) so they
   render inside React Server Components. Interactive variants accept an
   `href` and render a next/link.
   ════════════════════════════════════════════════════════════════════ */

export type Tone = 'neutral' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

/* ── Card ───────────────────────────────────────────────────────── */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  flat?: boolean;
}

export function Card({ children, padding = 'md', interactive, flat, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        'vbds-card',
        padding !== 'none' && `vbds-card--pad-${padding}`,
        interactive && 'vbds-card--interactive',
        flat && 'vbds-card--flat',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="vbds-card__header">
      <div style={{ minWidth: 0 }}>
        <h3 className="vbds-card__title">{title}</h3>
        {subtitle && <p className="vbds-card__subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── StatCard ───────────────────────────────────────────────────── */

export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  caption?: string;
  icon?: ReactNode;
  tone?: Exclude<Tone, 'neutral'>;
  href?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  trend = 'flat',
  caption,
  icon,
  tone = 'primary',
  href,
  className,
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : TrendFlat;

  const body = (
    <>
      <div className="vbds-stat-card__top">
        <span className="vbds-stat-card__label">{label}</span>
        {icon && (
          <span className="vbds-stat-card__chip" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <span className="vbds-stat-card__value">{value}</span>
      <div className="vbds-stat-card__meta">
        {delta && (
          <span className={cx('vbds-stat-card__delta', `vbds-stat-card__delta--${trend}`)}>
            <TrendIcon size={12} strokeWidth={2.5} />
            {delta}
          </span>
        )}
        {caption && <span className="vbds-stat-card__caption">{caption}</span>}
      </div>
    </>
  );

  const classes = cx(
    'vbds-stat-card',
    tone !== 'primary' && `vbds-stat-card--${tone}`,
    href && 'vbds-stat-card--interactive',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} style={{ textDecoration: 'none' }}>
        {body}
      </Link>
    );
  }
  return <div className={classes}>{body}</div>;
}

/* ── EmptyState ─────────────────────────────────────────────────── */

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'vbds-empty',
        size === 'sm' && 'vbds-empty--sm',
        tone === 'danger' && 'vbds-empty--danger',
        className,
      )}
    >
      <span className="vbds-empty__icon" aria-hidden="true">
        {icon ?? <Inbox size={22} />}
      </span>
      <span className="vbds-empty__title">{title}</span>
      {description && <span className="vbds-empty__desc">{description}</span>}
      {action && <span className="vbds-empty__action">{action}</span>}
    </div>
  );
}

/* ── Badge ──────────────────────────────────────────────────────── */

export interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md';
  dot?: boolean;
  outline?: boolean;
  className?: string;
  title?: string;
}

export function Badge({ children, tone = 'neutral', size = 'md', dot, outline, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cx(
        'vbds-badge',
        tone !== 'neutral' && `vbds-badge--${tone}`,
        size === 'sm' && 'vbds-badge--sm',
        outline && 'vbds-badge--outline',
        className,
      )}
    >
      {dot && <span className="vbds-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ── Chip ───────────────────────────────────────────────────────── */

export interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ label, selected, icon, count, disabled, onClick, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx('vbds-chip', selected && 'vbds-chip--selected', className)}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {label}
      {count !== undefined && <span className="vbds-chip__count">{count}</span>}
    </button>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────── */

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  square?: boolean;
  color?: string;
  className?: string;
  title?: string;
}

export function Avatar({ name, src, size = 'md', square, color, className, title }: AvatarProps) {
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

  const style: CSSProperties | undefined = color
    ? { background: color, color: '#fff' }
    : undefined;

  return (
    <span
      title={title ?? name}
      className={cx(
        'vbds-avatar',
        size !== 'md' && `vbds-avatar--${size}`,
        square && 'vbds-avatar--square',
        className,
      )}
      style={style}
    >
      {src ? <img src={src} alt="" /> : initials || '•'}
    </span>
  );
}

/* ── Divider ────────────────────────────────────────────────────── */

export function Divider({
  vertical,
  label,
  className,
}: {
  vertical?: boolean;
  label?: string;
  className?: string;
}) {
  if (label) {
    return <div className={cx('vbds-divider-labeled', className)}>{label}</div>;
  }
  return <hr className={cx('vbds-divider', vertical && 'vbds-divider--vertical', className)} />;
}

/* ── ListItem ───────────────────────────────────────────────────── */

export interface ListItemProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leadingIcon?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  trailingText?: string;
  selected?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function ListItem({
  title,
  subtitle,
  leadingIcon,
  leading,
  trailing,
  trailingText,
  selected,
  href,
  onClick,
  className,
}: ListItemProps) {
  const classes = cx(
    'vbds-list-item',
    selected && 'vbds-list-item--selected',
    !href && !onClick && 'vbds-list-item--static',
    className,
  );

  const inner = (
    <>
      {leading ??
        (leadingIcon && (
          <span className="vbds-list-item__leading-icon" aria-hidden="true">
            {leadingIcon}
          </span>
        ))}
      <span className="vbds-list-item__main">
        <span className="vbds-list-item__title">{title}</span>
        {subtitle && <span className="vbds-list-item__subtitle">{subtitle}</span>}
      </span>
      {(trailing || trailingText) && (
        <span className="vbds-list-item__trailing">
          {trailingText && <span className="vbds-list-item__trailing-text">{trailingText}</span>}
          {trailing}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className={classes}>{inner}</div>;
}

/* ── Definition list ────────────────────────────────────────────── */

export function DescriptionList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cx('astra-dl', className)}>{children}</dl>;
}

export function DescriptionItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="astra-dl__item">
      <dt className="astra-dl__term">{term}</dt>
      <dd className="astra-dl__desc">{children}</dd>
    </div>
  );
}
