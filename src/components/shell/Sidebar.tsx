'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ChartNoAxesColumn,
  FileText,
  FlaskConical,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cn';
import { Tooltip } from '@/components/vbds';
import { LogoMark } from './Logo';

interface NavEntry {
  href: string;
  label: string;
  icon: ReactNode;
  /** Matches nested routes, e.g. /products/benzyl-… */
  section?: string;
}

interface NavGroup {
  heading: string;
  items: NavEntry[];
}

const NAV: NavGroup[] = [
  {
    heading: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <Home size={16} /> },
      { href: '/search', label: 'Search Chemicals', icon: <Search size={16} /> },
    ],
  },
  {
    heading: 'Catalogue',
    items: [
      { href: '/products', label: 'Products', icon: <FlaskConical size={16} />, section: '/products' },
      { href: '/companies', label: 'Companies', icon: <Building2 size={16} />, section: '/companies' },
    ],
  },
  {
    heading: 'Insight',
    items: [
      { href: '/analytics', label: 'Analytics', icon: <ChartNoAxesColumn size={16} /> },
      { href: '/reports', label: 'Reports', icon: <FileText size={16} /> },
    ],
  },
  {
    heading: 'Administration',
    items: [{ href: '/settings', label: 'Settings', icon: <Settings size={16} />, section: '/settings' }],
  },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  counts,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate?: () => void;
  counts?: { products: number; companies: number };
}) {
  const pathname = usePathname();

  const isActive = (item: NavEntry) =>
    item.section ? pathname === item.section || pathname.startsWith(`${item.section}/`) : pathname === item.href;

  const countFor = (item: NavEntry) =>
    item.href === '/products' ? counts?.products : item.href === '/companies' ? counts?.companies : undefined;

  return (
    <aside className="astra-sidebar">
      <Link href="/dashboard" className="astra-sidebar__brand" onClick={onNavigate}>
        <LogoMark />
        {!collapsed && (
          <span style={{ minWidth: 0 }}>
            <span className="astra-sidebar__wordmark">nipponkayaku</span>
            <span className="astra-sidebar__tagline" style={{ display: 'block' }}>
              Chemical Intelligence
            </span>
          </span>
        )}
      </Link>

      <nav className="astra-sidebar__nav" aria-label="Main">
        {NAV.map((group) => (
          <div key={group.heading}>
            <div className="astra-sidebar__section">{group.heading}</div>
            {group.items.map((item) => {
              const active = isActive(item);
              const count = countFor(item);

              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cx('astra-nav-item', active && 'astra-nav-item--active')}
                >
                  <span className="astra-nav-item__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="astra-nav-item__label">{item.label}</span>
                  {count !== undefined && <span className="astra-nav-item__count">{count}</span>}
                </Link>
              );

              return collapsed ? (
                <Tooltip key={item.href} content={item.label} side="right">
                  {link}
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>

      <div className="astra-sidebar__footer">
        <button
          type="button"
          className="astra-nav-item"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span className="astra-nav-item__icon" aria-hidden="true">
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </span>
          <span className="astra-nav-item__label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
