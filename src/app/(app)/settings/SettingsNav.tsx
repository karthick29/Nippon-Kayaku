'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, History, KeyRound, SlidersHorizontal, Users } from 'lucide-react';
import { cx } from '@/lib/cn';

const ITEMS = [
  { href: '/settings', label: 'Preferences', icon: <SlidersHorizontal size={15} />, exact: true },
  { href: '/settings/users', label: 'Users', icon: <Users size={15} /> },
  { href: '/settings/roles', label: 'Roles & Permissions', icon: <KeyRound size={15} /> },
  { href: '/settings/master-data', label: 'Master Data', icon: <Database size={15} /> },
  { href: '/settings/audit', label: 'Audit Logs', icon: <History size={15} /> },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="astra-settings__nav" aria-label="Settings sections">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cx('astra-nav-item', active && 'astra-nav-item--active')}
          >
            <span className="astra-nav-item__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="astra-nav-item__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
