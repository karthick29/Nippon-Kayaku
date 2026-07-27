import 'server-only';
import { memoryRepo } from './memory';
import type { Repository } from './contract';

/* ════════════════════════════════════════════════════════════════════
   Adapter selection.

   ASTRA_DATA_SOURCE=memory (default) — zero-setup, process-local store.
   ASTRA_DATA_SOURCE=prisma          — PostgreSQL via prisma/schema.prisma.

   The Prisma adapter is loaded lazily so a missing generated client or
   an unreachable database never breaks the default dev experience.
   ════════════════════════════════════════════════════════════════════ */

export type DataSource = 'memory' | 'prisma';

export const DATA_SOURCE: DataSource =
  process.env.ASTRA_DATA_SOURCE === 'prisma' && process.env.DATABASE_URL ? 'prisma' : 'memory';

let cached: Repository | null = null;

export function getRepository(): Repository {
  if (cached) return cached;

  if (DATA_SOURCE === 'prisma') {
    try {
      // Lazy require keeps @prisma/client out of the bundle when unused.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { prismaRepo } = require('./prisma') as { prismaRepo: Repository };
      cached = prismaRepo;
      return cached;
    } catch (error) {
      console.warn(
        '[astra] ASTRA_DATA_SOURCE=prisma but the Prisma client could not be loaded. ' +
          'Run `npm run db:generate && npm run db:push && npm run db:seed`. Falling back to the in-memory store.',
        error instanceof Error ? error.message : error,
      );
    }
  }

  cached = memoryRepo;
  return cached;
}

export const repo = getRepository();

export type { Actor, CompanyInput, ProductInput, Repository } from './contract';
