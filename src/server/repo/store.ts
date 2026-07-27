import 'server-only';
import { buildDataset, type Dataset } from '@/data/dataset';

/* ════════════════════════════════════════════════════════════════════
   Process-local mutable store.

   Held on globalThis so Next.js hot reload and route handlers share one
   instance. This is the default ASTRA data source: it makes `npm run
   dev` work with zero infrastructure. Writes live for the life of the
   process — set DATABASE_URL and ASTRA_DATA_SOURCE=prisma to persist.
   ════════════════════════════════════════════════════════════════════ */

declare global {
  // eslint-disable-next-line no-var
  var __astraStore: Dataset | undefined;
}

export function getStore(): Dataset {
  if (!globalThis.__astraStore) {
    globalThis.__astraStore = buildDataset();
  }
  return globalThis.__astraStore;
}

/** Test/dev helper — rebuilds the corpus, discarding in-process writes. */
export function resetStore(): Dataset {
  globalThis.__astraStore = buildDataset();
  return globalThis.__astraStore;
}
