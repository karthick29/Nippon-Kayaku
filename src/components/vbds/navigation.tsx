'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cn';

/* ════════════════════════════════════════════════════════════════════
   Ported from designsystem/src/components/Tabs.tsx, plus a Breadcrumbs
   composite (no VBDS equivalent — the POS system had no deep hierarchy).

   Two Tabs flavours: `Tabs` for local state, `LinkTabs` for URL-driven
   tabs on detail pages so a tab is shareable and back-navigable.
   ════════════════════════════════════════════════════════════════════ */

export interface TabItem {
  label: string;
  value: string;
  icon?: ReactNode;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  fullWidth?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function Tabs({ tabs, value, onValueChange, fullWidth, ariaLabel, className }: TabsProps) {
  return (
    <div
      className={cx('vbds-tabs', fullWidth && 'vbds-tabs--full', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          className={cx('vbds-tabs__tab', t.value === value && 'vbds-tabs__tab--active')}
          onClick={() => onValueChange(t.value)}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className="vbds-tabs__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export interface LinkTabsProps {
  tabs: Array<TabItem & { href: string }>;
  activeValue: string;
  fullWidth?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function LinkTabs({ tabs, activeValue, fullWidth, ariaLabel, className }: LinkTabsProps) {
  return (
    <nav
      className={cx('vbds-tabs', fullWidth && 'vbds-tabs--full', className)}
      aria-label={ariaLabel ?? 'Section'}
    >
      {tabs.map((t) => {
        const active = t.value === activeValue;
        return (
          <Link
            key={t.value}
            href={t.href}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={cx('vbds-tabs__tab', active && 'vbds-tabs__tab--active')}
            style={{ textDecoration: 'none' }}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && <span className="vbds-tabs__count">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav className={cx('vbds-crumbs', className)} aria-label="Breadcrumb">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
            {c.href && !last ? (
              <Link href={c.href} className="vbds-crumbs__link">
                {c.label}
              </Link>
            ) : (
              <span className="vbds-crumbs__current" aria-current={last ? 'page' : undefined}>
                {c.label}
              </span>
            )}
            {!last && (
              <span className="vbds-crumbs__sep" aria-hidden="true">
                <ChevronRight size={12} />
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
