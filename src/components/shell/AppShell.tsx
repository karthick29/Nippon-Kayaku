'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { TooltipProvider } from '@/components/vbds';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Topbar, type TopbarUser } from './Topbar';

/* ════════════════════════════════════════════════════════════════════
   Application shell.

   Owns the three pieces of chrome state that must be shared: sidebar
   collapse, mobile drawer, and the ⌘K palette. Everything else is a
   server component underneath `children`.
   ════════════════════════════════════════════════════════════════════ */

const COLLAPSE_KEY = 'astra.sidebar-collapsed';

export function AppShell({
  user,
  counts,
  notificationCount,
  children,
}: {
  user: TopbarUser;
  counts: { products: number; companies: number };
  notificationCount: number;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // ⌘K / Ctrl+K anywhere, and "/" when not already typing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const typing =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.tagName === 'SELECT' ||
          target?.isContentEditable;
        if (!typing) {
          event.preventDefault();
          setPaletteOpen(true);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <TooltipProvider>
      <a href="#astra-main" className="astra-skip-link">
        Skip to main content
      </a>

      <div className="astra-shell" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onNavigate={() => setMobileOpen(false)}
          counts={counts}
        />

        {mobileOpen && (
          <button
            type="button"
            className="astra-shell__scrim"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Topbar
            user={user}
            notificationCount={notificationCount}
            onOpenSearch={() => setPaletteOpen(true)}
            onOpenMobileNav={() => setMobileOpen(true)}
          />
          <main id="astra-main" style={{ flex: 1, minWidth: 0 }}>
            {children}
          </main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </TooltipProvider>
  );
}
