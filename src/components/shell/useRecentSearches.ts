'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'astra.recent-searches';
const MAX = 8;

/**
 * Recent searches, persisted per browser. Kept client-side deliberately:
 * a user's half-typed queries are not something the platform needs to
 * store server-side, and localStorage keeps the palette instant.
 */
export function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setRecents(JSON.parse(raw) as string[]);
    } catch {
      /* corrupt or unavailable — start empty */
    }
  }, []);

  const persist = useCallback((next: string[]) => {
    setRecents(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const addRecent = useCallback(
    (term: string) => {
      const clean = term.trim();
      if (clean.length < 2) return;
      setRecents((current) => {
        const next = [clean, ...current.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, MAX);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const clearRecents = useCallback(() => persist([]), [persist]);

  return { recents, addRecent, clearRecents };
}
