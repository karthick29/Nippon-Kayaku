'use client';

import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { Application, EquipmentMaster, Location, ProductCategory, ProductStatus } from '@/lib/types';
import { Badge, Button, Chip, SearchField, SegmentedControl, Select } from '@/components/vbds';
import { useRecentSearches } from '@/components/shell/useRecentSearches';

/* ════════════════════════════════════════════════════════════════════
   Search controls.

   The URL is the single source of truth for query, filters, sort and
   view — every result state is shareable, bookmarkable and survives back
   navigation. Typing debounces at 200 ms into a `replace`, so the
   history stack keeps one entry per search rather than one per keypress.
   ════════════════════════════════════════════════════════════════════ */

export interface SearchFacets {
  applications: Application[];
  categories: ProductCategory[];
  locations: Location[];
  equipment: EquipmentMaster[];
  statuses: ProductStatus[];
}

const SORTS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'casNumber', label: 'CAS number' },
  { value: 'companyCount', label: 'Most suppliers' },
  { value: 'createdAt', label: 'Recently added' },
];

export function SearchControls({
  facets,
  resultCount,
  popular,
}: {
  facets: SearchFacets;
  resultCount: number;
  popular: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { recents, addRecent } = useRecentSearches();

  const [draft, setDraft] = useState(params.get('q') ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const committed = useRef(params.get('q') ?? '');

  // Keep the input in sync when the URL changes from elsewhere
  // (a popular-search chip, browser back, a palette navigation).
  useEffect(() => {
    const urlQuery = params.get('q') ?? '';
    if (urlQuery !== committed.current) {
      committed.current = urlQuery;
      setDraft(urlQuery);
    }
  }, [params]);

  const push = useCallback(
    (mutate: (next: URLSearchParams) => void, replace = false) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete('page'); // any filter change resets paging
      const url = `${pathname}${next.toString() ? `?${next}` : ''}`;
      startTransition(() => {
        if (replace) router.replace(url, { scroll: false });
        else router.push(url, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  // Debounced commit of the search box.
  useEffect(() => {
    if (draft === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = draft;
      if (draft.trim().length >= 2) addRecent(draft);
      push((next) => {
        if (draft.trim()) next.set('q', draft.trim());
        else next.delete('q');
      }, true);
    }, 200);
    return () => clearTimeout(timer);
  }, [draft, push, addRecent]);

  const activeValues = useCallback((key: string) => params.getAll(key).flatMap((v) => v.split(',')).filter(Boolean), [params]);

  const toggle = useCallback(
    (key: string, value: string) => {
      const current = activeValues(key);
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      push((p) => {
        p.delete(key);
        if (next.length) p.set(key, next.join(','));
      });
    },
    [activeValues, push],
  );

  const activeFilterCount = useMemo(
    () =>
      ['status', 'application', 'category', 'location', 'equipment'].reduce(
        (sum, key) => sum + activeValues(key).length,
        0,
      ),
    [activeValues],
  );

  const view = params.get('view') === 'list' ? 'list' : 'grid';
  const sort = params.get('sort') ?? 'relevance';
  const hasQuery = (params.get('q') ?? '').trim().length > 0;

  function clearAll() {
    setDraft('');
    committed.current = '';
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  return (
    <div className="astra-search-panel">
      <SearchField
        hero
        fullWidth
        value={draft}
        onValueChange={setDraft}
        placeholder="Search by product name, CAS number, synonym, formula, company or application…"
        aria-label="Search chemicals"
        trailing={pending ? <span className="vbds-spinner vbds-spinner--sm" aria-label="Searching" /> : undefined}
      />

      {!hasQuery && popular.length > 0 && (
        <div className="astra-search-panel__row">
          <span className="astra-search-panel__hint">Popular chemicals</span>
          {popular.map((term) => (
            <Chip key={term} label={term} onClick={() => setDraft(term)} />
          ))}
        </div>
      )}

      {!hasQuery && recents.length > 0 && (
        <div className="astra-search-panel__row">
          <span className="astra-search-panel__hint">Recent</span>
          {recents.slice(0, 5).map((term) => (
            <Chip key={term} label={term} onClick={() => setDraft(term)} />
          ))}
        </div>
      )}

      <div className="astra-search-panel__toolbar">
        <Button
          variant={showFilters ? 'secondary' : 'outlined'}
          size="sm"
          icon={<SlidersHorizontal size={14} />}
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          Filters
          {activeFilterCount > 0 && (
            <Badge tone="primary" size="sm">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="text" size="sm" icon={<X size={13} />} onClick={clearAll}>
            Clear all
          </Button>
        )}

        <span className="astra-search-panel__count">
          {pending ? 'Searching…' : `${resultCount} ${resultCount === 1 ? 'result' : 'results'}`}
        </span>

        <div style={{ flex: 1 }} />

        <Select
          options={SORTS}
          value={sort}
          onChange={(e) => push((p) => p.set('sort', e.target.value))}
          aria-label="Sort results"
          className="astra-search-panel__sort"
        />

        <SegmentedControl
          ariaLabel="Result layout"
          value={view}
          onValueChange={(v) => push((p) => p.set('view', v))}
          items={[
            { value: 'grid', label: 'Grid', icon: <LayoutGrid size={13} /> },
            { value: 'list', label: 'List', icon: <List size={13} /> },
          ]}
        />
      </div>

      {showFilters && (
        <div className="astra-facets">
          <FacetGroup
            label="Status"
            options={facets.statuses.map((s) => ({ value: s, label: s }))}
            active={activeValues('status')}
            onToggle={(v) => toggle('status', v)}
          />
          <FacetGroup
            label="Application"
            options={facets.applications.map((a) => ({ value: a.id, label: a.name }))}
            active={activeValues('application')}
            onToggle={(v) => toggle('application', v)}
          />
          <FacetGroup
            label="Category"
            options={facets.categories.map((c) => ({ value: c.id, label: c.name }))}
            active={activeValues('category')}
            onToggle={(v) => toggle('category', v)}
          />
          <FacetGroup
            label="Location"
            options={facets.locations.map((l) => ({ value: l.id, label: l.name }))}
            active={activeValues('location')}
            onToggle={(v) => toggle('location', v)}
          />
          <FacetGroup
            label="Supplier capability"
            options={facets.equipment.map((e) => ({ value: e.key, label: e.name }))}
            active={activeValues('equipment')}
            onToggle={(v) => toggle('equipment', v)}
          />
        </div>
      )}
    </div>
  );
}

function FacetGroup({
  label,
  options,
  active,
  onToggle,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  active: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="astra-facets__group">
      <legend className="astra-facets__legend">{label}</legend>
      <div className="astra-facets__chips">
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={active.includes(option.value)}
            onClick={() => onToggle(option.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}
