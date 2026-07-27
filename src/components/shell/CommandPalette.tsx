'use client';

import { Command } from 'cmdk';
import * as RDialog from '@radix-ui/react-dialog';
import {
  Beaker,
  Building2,
  ChartNoAxesColumn,
  FileText,
  FlaskConical,
  Home,
  MapPin,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Tags,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SearchHit } from '@/lib/types';
import { useTheme } from './ThemeProvider';
import { useRecentSearches } from './useRecentSearches';

/* ════════════════════════════════════════════════════════════════════
   ⌘K command palette.

   Single entry point for navigation, actions and unified search across
   products, companies, applications and locations. Debounced at 140 ms —
   fast enough to feel instant, slow enough not to fire on every
   keystroke of a long CAS number.
   ════════════════════════════════════════════════════════════════════ */

interface StaticCommand {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  keywords: string;
  run: (ctx: { router: ReturnType<typeof useRouter>; toggleTheme: () => void }) => void;
}

const NAVIGATION: StaticCommand[] = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: <Home size={14} />, keywords: 'home overview kpi', run: ({ router }) => router.push('/dashboard') },
  { id: 'nav-search', label: 'Search Chemicals', icon: <Search size={14} />, keywords: 'find cas molecule', run: ({ router }) => router.push('/search') },
  { id: 'nav-products', label: 'Products', icon: <FlaskConical size={14} />, keywords: 'chemicals catalogue table', run: ({ router }) => router.push('/products') },
  { id: 'nav-companies', label: 'Companies', icon: <Building2 size={14} />, keywords: 'suppliers cdmo manufacturers', run: ({ router }) => router.push('/companies') },
  { id: 'nav-analytics', label: 'Analytics', icon: <ChartNoAxesColumn size={14} />, keywords: 'charts insights metrics', run: ({ router }) => router.push('/analytics') },
  { id: 'nav-reports', label: 'Reports', icon: <FileText size={14} />, keywords: 'export pdf excel', run: ({ router }) => router.push('/reports') },
  { id: 'nav-settings', label: 'Settings', icon: <Settings size={14} />, keywords: 'users roles master data audit', run: ({ router }) => router.push('/settings') },
];

const ACTIONS: StaticCommand[] = [
  {
    id: 'act-new-product',
    label: 'Add product',
    hint: 'Open the new product wizard',
    icon: <Plus size={14} />,
    keywords: 'create new chemical',
    run: ({ router }) => router.push('/products/new'),
  },
  {
    id: 'act-theme',
    label: 'Toggle theme',
    hint: 'Switch between light and dark',
    icon: <Sun size={14} />,
    keywords: 'dark light appearance',
    run: ({ toggleTheme }) => toggleTheme(),
  },
];

const HIT_ICON: Record<SearchHit['type'], ReactNode> = {
  product: <Beaker size={14} />,
  company: <Building2 size={14} />,
  application: <Tags size={14} />,
  location: <MapPin size={14} />,
};

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const { recents, addRecent } = useRecentSearches();

  // Debounced unified search. AbortController drops stale responses so a
  // slow early request cannot overwrite a fast later one.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=12`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((body: { data?: SearchHit[] }) => setHits(body.data ?? []))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 140);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Reset on close so the next ⌘K opens clean.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
    }
  }, [open]);

  const go = useCallback(
    (href: string, label?: string) => {
      if (label) addRecent(label);
      onOpenChange(false);
      router.push(href);
    },
    [addRecent, onOpenChange, router],
  );

  const staticCommands = useMemo(() => ({ NAVIGATION, ACTIONS }), []);

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="vbds-dialog-scrim" />
        <RDialog.Content className="astra-cmdk" aria-label="Command palette">
          <RDialog.Title className="astra-sr-only">Search and commands</RDialog.Title>
          <RDialog.Description className="astra-sr-only">
            Search products, companies, applications and locations, or run a command.
          </RDialog.Description>

          <Command shouldFilter={false} loop>
            <div className="astra-cmdk__input-row">
              <Search size={17} style={{ color: 'var(--vbds-text-tertiary)', flexShrink: 0 }} aria-hidden="true" />
              <Command.Input
                className="astra-cmdk__input"
                value={query}
                onValueChange={setQuery}
                placeholder="Search chemicals, CAS numbers, companies…"
                autoFocus
              />
              {loading && <span className="vbds-spinner vbds-spinner--sm" aria-label="Searching" />}
            </div>

            <Command.List className="astra-cmdk__list">
              {query.trim().length >= 2 && !loading && hits.length === 0 && (
                <Command.Empty className="astra-cmdk__empty">
                  No matches for “{query.trim()}”. Try a CAS number, a product name, or a company.
                </Command.Empty>
              )}

              {hits.length > 0 && (
                <Command.Group heading="Results" className="astra-cmdk__group">
                  <div className="astra-cmdk__group-heading">Results</div>
                  {hits.map((hit) => (
                    <Command.Item
                      key={`${hit.type}-${hit.id}`}
                      value={`${hit.type}-${hit.id}`}
                      className="astra-cmdk__item"
                      onSelect={() => go(hit.href, hit.title)}
                    >
                      <span className="astra-cmdk__item-icon" aria-hidden="true">
                        {HIT_ICON[hit.type]}
                      </span>
                      <span className="astra-cmdk__item-main">
                        <span className="astra-cmdk__item-title">{hit.title}</span>
                        <span className="astra-cmdk__item-sub">
                          {hit.subtitle} · matched {hit.matchedField.toLowerCase()}
                        </span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {query.trim().length < 2 && recents.length > 0 && (
                <Command.Group heading="Recent searches">
                  <div className="astra-cmdk__group-heading">Recent searches</div>
                  {recents.slice(0, 4).map((term) => (
                    <Command.Item
                      key={`recent-${term}`}
                      value={`recent-${term}`}
                      className="astra-cmdk__item"
                      onSelect={() => setQuery(term)}
                    >
                      <span className="astra-cmdk__item-icon" aria-hidden="true">
                        <Search size={14} />
                      </span>
                      <span className="astra-cmdk__item-main">
                        <span className="astra-cmdk__item-title">{term}</span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {query.trim().length < 2 && (
                <>
                  <Command.Group heading="Go to">
                    <div className="astra-cmdk__group-heading">Go to</div>
                    {staticCommands.NAVIGATION.map((c) => (
                      <Command.Item
                        key={c.id}
                        value={c.id}
                        className="astra-cmdk__item"
                        onSelect={() => {
                          onOpenChange(false);
                          c.run({ router, toggleTheme });
                        }}
                      >
                        <span className="astra-cmdk__item-icon" aria-hidden="true">
                          {c.icon}
                        </span>
                        <span className="astra-cmdk__item-main">
                          <span className="astra-cmdk__item-title">{c.label}</span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>

                  <Command.Group heading="Actions">
                    <div className="astra-cmdk__group-heading">Actions</div>
                    {staticCommands.ACTIONS.map((c) => (
                      <Command.Item
                        key={c.id}
                        value={c.id}
                        className="astra-cmdk__item"
                        onSelect={() => {
                          if (c.id !== 'act-theme') onOpenChange(false);
                          c.run({ router, toggleTheme });
                        }}
                      >
                        <span className="astra-cmdk__item-icon" aria-hidden="true">
                          {c.id === 'act-theme' ? (
                            theme === 'dark' ? (
                              <Sun size={14} />
                            ) : (
                              <Moon size={14} />
                            )
                          ) : (
                            c.icon
                          )}
                        </span>
                        <span className="astra-cmdk__item-main">
                          <span className="astra-cmdk__item-title">{c.label}</span>
                          {c.hint && <span className="astra-cmdk__item-sub">{c.hint}</span>}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                </>
              )}
            </Command.List>

            <div className="astra-cmdk__footer">
              <span className="astra-kbd">↑↓</span> navigate
              <span className="astra-kbd">↵</span> open
              <span className="astra-kbd">esc</span> close
              <span style={{ marginLeft: 'auto' }}>
                {query.trim().length >= 2 ? `${hits.length} results` : 'ASTRA'}
              </span>
            </div>
          </Command>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
