'use client';

import { Bell, LogOut, Menu as MenuIcon, Moon, Plus, Search, Settings, Sun, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Role } from '@/lib/types';
import { Avatar, Badge, Button, IconButton, Menu, MenuItem, MenuLabel, MenuSeparator, Tooltip } from '@/components/vbds';
import { ROLE_LABELS, can } from '@/server/rbac';
import { signOutAction } from '@/server/actions/auth';
import { useTheme } from './ThemeProvider';

export interface TopbarUser {
  name: string;
  email: string;
  role: Role;
  title?: string;
}

export function Topbar({
  user,
  notificationCount,
  onOpenSearch,
  onOpenMobileNav,
}: {
  user: TopbarUser;
  notificationCount: number;
  onOpenSearch: () => void;
  onOpenMobileNav: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="astra-topbar">
      <span className="astra-topbar__mobile-nav">
        <IconButton icon={<MenuIcon size={17} />} label="Open navigation" onClick={onOpenMobileNav} />
      </span>

      <div className="astra-topbar__search">
        <button type="button" className="astra-search-trigger" onClick={onOpenSearch}>
          <Search size={15} aria-hidden="true" />
          <span className="astra-search-trigger__text">Search chemicals, CAS, companies…</span>
          <span className="astra-kbd" aria-hidden="true">
            {mac ? '⌘' : 'Ctrl'} K
          </span>
        </button>
      </div>

      <div className="astra-topbar__spacer" />

      <div className="astra-topbar__actions">
        {can(user.role, 'product:create') && (
          <span className="astra-topbar__quick-add">
            <Button size="sm" icon={<Plus size={14} />} href="/products/new">
              Add Product
            </Button>
          </span>
        )}

        <Menu
          trigger={
            <button
              type="button"
              className="vbds-icon-button"
              aria-label={`Notifications, ${notificationCount} unread`}
              style={{ position: 'relative' }}
            >
              <Bell size={16} />
              {notificationCount > 0 && <span className="astra-topbar__dot" aria-hidden="true" />}
            </button>
          }
        >
          <MenuLabel>Notifications</MenuLabel>
          <MenuItem onSelect={() => router.push('/settings/audit')}>
            {notificationCount} recent changes in the audit log
          </MenuItem>
          <MenuItem onSelect={() => router.push('/products?status=Development')}>
            Development products awaiting review
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => router.push('/settings/audit')}>View all activity</MenuItem>
        </Menu>

        <Tooltip content={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          <IconButton
            icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
          />
        </Tooltip>

        <Menu
          trigger={
            <button
              type="button"
              aria-label="Account menu"
              style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', borderRadius: 999 }}
            >
              <Avatar name={user.name} size="sm" />
            </button>
          }
        >
          <div style={{ padding: '8px 8px 10px', minWidth: 200 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--vbds-body-size)' }}>{user.name}</div>
            <div style={{ fontSize: 'var(--vbds-caption-size)', color: 'var(--vbds-text-secondary)' }}>
              {user.email}
            </div>
            <div style={{ marginTop: 6 }}>
              <Badge tone="primary" size="sm">
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
          </div>
          <MenuSeparator />
          <MenuItem icon={<UserIcon size={14} />} onSelect={() => router.push('/settings/users')}>
            Profile & users
          </MenuItem>
          <MenuItem icon={<Settings size={14} />} onSelect={() => router.push('/settings')}>
            Settings
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LogOut size={14} />} danger onSelect={() => void signOutAction()}>
            Sign out
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
}
