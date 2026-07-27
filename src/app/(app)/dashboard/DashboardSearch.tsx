'use client';

import { ArrowRight, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Card, Chip, SearchField } from '@/components/vbds';

const QUICK_SEARCHES = [
  { label: 'Benzyl chloroformate', query: 'benzyl chloroformate' },
  { label: 'CAS 501-53-1', query: '501-53-1' },
  { label: 'Flow chemistry', query: 'flow' },
  { label: 'Bangalore', query: 'bangalore' },
  { label: 'Catalyst', query: 'catalyst' },
];

/** Floating search block at the top of the dashboard — the fastest route
 *  into the catalogue for someone who arrived with a name in mind. */
export function DashboardSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  }

  return (
    <Card padding="md" className="astra-dash-search">
      <form onSubmit={submit} style={{ display: 'flex', gap: 'var(--vbds-space-8)', alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchField
            fullWidth
            value={query}
            onValueChange={setQuery}
            placeholder="Search by product name, CAS number, company, application or capability…"
            aria-label="Search chemicals"
          />
        </div>
        <Button type="submit" icon={<Search size={14} />}>
          Search
        </Button>
      </form>

      <div
        style={{
          display: 'flex',
          gap: 'var(--vbds-space-8)',
          marginTop: 'var(--vbds-space-12)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 'var(--vbds-caption-size)', color: 'var(--vbds-text-tertiary)' }}>
          Popular:
        </span>
        {QUICK_SEARCHES.map((item) => (
          <Chip
            key={item.query}
            label={item.label}
            onClick={() => router.push(`/search?q=${encodeURIComponent(item.query)}`)}
          />
        ))}
        <Button variant="text" size="sm" href="/search" trailingIcon={<ArrowRight size={13} />}>
          Advanced search
        </Button>
      </div>
    </Card>
  );
}
