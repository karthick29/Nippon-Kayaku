'use client';

import { Equal, Hexagon, LayoutGrid, List, Shapes, SlidersHorizontal, TextSearch, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
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

type SearchMode = 'text' | 'substructure' | 'similarity' | 'exact';

const MODES: Array<{ value: SearchMode; label: string; icon: ReactNode }> = [
  { value: 'text', label: 'Text', icon: <TextSearch size={13} /> },
  { value: 'substructure', label: 'Substructure', icon: <Hexagon size={13} /> },
  { value: 'similarity', label: 'Similarity', icon: <Shapes size={13} /> },
  { value: 'exact', label: 'Exact structure', icon: <Equal size={13} /> },
];

const PLACEHOLDERS: Record<SearchMode, string> = {
  text: 'Search by product name, CAS number, synonym, formula, company or application…',
  substructure: 'Fragment as SMILES or SMARTS, e.g. C1CO1 for an epoxide…',
  similarity: 'Structure as SMILES — finds similar molecules…',
  exact: 'Structure as SMILES — finds the same compound, and stereoisomers…',
};

/** Example queries per structure mode — each is a real hit in the seed catalogue. */
const STRUCTURE_EXAMPLES: Record<Exclude<SearchMode, 'text'>, Array<{ label: string; query: string }>> = {
  substructure: [
    { label: 'Epoxide', query: 'C1CO1' },
    { label: 'Benzaldehyde', query: 'O=Cc1ccccc1' },
    { label: 'Pyridine', query: 'c1ccncc1' },
    { label: 'Imidazole', query: 'c1cnc[nH]1' },
    { label: 'Acyl chloride (SMARTS)', query: '[CX3](=O)Cl' },
  ],
  similarity: [
    { label: 'Vanillin', query: 'COc1cc(C=O)ccc1O' },
    { label: '2-Methylimidazole', query: 'Cc1ncc[nH]1' },
    { label: 'Chlorpyrifos', query: 'CCOP(=S)(OCC)Oc1nc(Cl)c(Cl)cc1Cl' },
  ],
  exact: [
    { label: 'Epichlorohydrin (racemic)', query: 'ClCC1CO1' },
    { label: 'Morpholine', query: 'C1COCCN1' },
  ],
};

const THRESHOLDS = ['0.3', '0.4', '0.5', '0.6', '0.7', '0.8'].map((v) => ({
  value: v,
  label: `≥ ${Math.round(Number(v) * 100)}% similar`,
}));

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

  const mode: SearchMode = MODES.some((m) => m.value === params.get('mode')) ? (params.get('mode') as SearchMode) : 'text';
  const isStructure = mode !== 'text';
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
    // Structures debounce longer: a half-typed SMILES is usually invalid, and
    // a 422 flashing on every keystroke is noise.
    const timer = setTimeout(() => {
      committed.current = draft;
      if (!isStructure && draft.trim().length >= 2) addRecent(draft);
      push((next) => {
        if (draft.trim()) next.set('q', draft.trim());
        else next.delete('q');
      }, true);
    }, isStructure ? 600 : 200);
    return () => clearTimeout(timer);
  }, [draft, push, addRecent, isStructure]);

  /** Text ↔ structure clears the query (a name isn't a SMILES); between structure modes it's kept. */
  function setMode(next: SearchMode) {
    const crossing = (next === 'text') !== isStructure;
    if (crossing) {
      setDraft('');
      committed.current = '';
    }
    push((p) => {
      if (next === 'text') p.delete('mode');
      else p.set('mode', next);
      if (crossing) p.delete('q');
      if (next !== 'similarity') p.delete('threshold');
      if (next !== 'text') p.delete('sort');
    });
  }

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
    startTransition(() => router.push(isStructure ? `${pathname}?mode=${mode}` : pathname, { scroll: false }));
  }

  return (
    <div className="astra-search-panel">
      <div className="astra-search-panel__modes">
        <SegmentedControl ariaLabel="Search mode" value={mode} onValueChange={(v) => setMode(v as SearchMode)} items={MODES} />
      </div>
      <SearchField
        hero
        fullWidth
        value={draft}
        onValueChange={setDraft}
        placeholder={PLACEHOLDERS[mode]}
        aria-label={isStructure ? 'Structure query (SMILES or SMARTS)' : 'Search chemicals'}
        spellCheck={!isStructure}
        autoCapitalize="off"
        className={isStructure ? 'astra-search-panel__field--structure' : undefined}
        trailing={pending ? <span className="vbds-spinner vbds-spinner--sm" aria-label="Searching" /> : undefined}
      />

      {isStructure && (
        <p className="astra-search-panel__structure-hint">
          {mode === 'substructure'
            ? 'Matches any product containing the fragment. A SMILES fragment doesn’t fix hydrogen counts, so O=Cc1ccccc1 also finds aryl ketones — use SMARTS such as [CH1](=O)c for aldehydes only.'
            : mode === 'similarity'
              ? 'Ranks products by Tanimoto similarity of Morgan fingerprints (radius 2).'
              : 'Identical InChIKey is an exact match; same skeleton with different stereochemistry or isotopes is listed as same connectivity.'}
        </p>
      )}

      {isStructure && !hasQuery && (
        <div className="astra-search-panel__row">
          <span className="astra-search-panel__hint">Try</span>
          {STRUCTURE_EXAMPLES[mode].map((example) => (
            <Chip key={example.query} label={example.label} onClick={() => setDraft(example.query)} />
          ))}
        </div>
      )}

      {!isStructure && !hasQuery && popular.length > 0 && (
        <div className="astra-search-panel__row">
          <span className="astra-search-panel__hint">Popular chemicals</span>
          {popular.map((term) => (
            <Chip key={term} label={term} onClick={() => setDraft(term)} />
          ))}
        </div>
      )}

      {!isStructure && !hasQuery && recents.length > 0 && (
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

        {mode === 'similarity' && (
          <Select
            options={THRESHOLDS}
            value={params.get('threshold') ?? '0.5'}
            onChange={(e) => push((p) => p.set('threshold', e.target.value))}
            aria-label="Minimum similarity"
            className="astra-search-panel__sort"
          />
        )}

        {!isStructure && (
          <Select
            options={SORTS}
            value={sort}
            onChange={(e) => push((p) => p.set('sort', e.target.value))}
            aria-label="Sort results"
            className="astra-search-panel__sort"
          />
        )}

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
