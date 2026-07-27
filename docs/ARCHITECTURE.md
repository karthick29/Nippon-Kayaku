# Architecture

## Contents

1. [Layering](#layering)
2. [Folder structure](#folder-structure)
3. [Data layer](#data-layer)
4. [Search engine](#search-engine)
5. [Authentication](#authentication)
6. [Authorization (RBAC)](#authorization-rbac)
7. [Rendering strategy](#rendering-strategy)
8. [Performance](#performance)
9. [Security](#security)
10. [Accessibility](#accessibility)

---

## Layering

Five layers, each depending only on the one below it:

```
  Pages / route handlers        src/app/**
        │
  Components                    src/components/{vbds,charts,data-table,search,shell,page}
        │
  Domain services               src/server/{auth,rbac,api}
        │
  Repository (interface)        src/server/repo/contract.ts
        │
    ┌───┴────┐
  memory   prisma               src/server/repo/{memory,prisma}.ts
```

The rule that keeps this honest: **nothing above `contract.ts` imports from an adapter.** Pages
import `repo` from `src/server/repo`, which picks an adapter at module load. Swapping the data
source is one environment variable.

---

## Folder structure

```
src/
├── app/
│   ├── layout.tsx                  Root layout, fonts, theme bootstrap script
│   ├── providers.tsx               QueryClient, ThemeProvider, Toaster
│   ├── page.tsx                    Redirects to /dashboard or /sign-in
│   ├── not-found.tsx               Unauthenticated 404
│   ├── sign-in/                    Credentials form (Server Action)
│   ├── (app)/                      Authenticated route group
│   │   ├── layout.tsx              Auth guard + AppShell + nav counts
│   │   ├── error.tsx               Error boundary with retry
│   │   ├── not-found.tsx           In-shell 404
│   │   ├── dashboard/
│   │   ├── search/
│   │   ├── products/
│   │   │   ├── page.tsx            Data table
│   │   │   ├── new/                Three-step wizard
│   │   │   └── [slug]/
│   │   │       ├── page.tsx        Five tabs
│   │   │       └── edit/
│   │   ├── companies/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/             Five tabs
│   │   ├── analytics/
│   │   ├── reports/
│   │   └── settings/               Layout + nav + 5 sub-pages
│   └── api/                        REST route handlers
├── components/
│   ├── vbds/                       Design system port (actions, inputs, display, navigation, feedback, overlays)
│   ├── charts/                     ChartCard, MagnitudeBars, StatusStack, TrendChart, chart-theme
│   ├── data-table/                 Generic TanStack DataTable
│   ├── search/                     Highlight, ProductResultCard
│   ├── shell/                      AppShell, Sidebar, Topbar, CommandPalette, ThemeProvider, Logo
│   └── page/                       PageHeader, Stack
├── data/                           Deterministic seed corpus
│   ├── masters.ts                  Applications, categories, locations, equipment master
│   ├── companies.ts                22 company seeds + equipment expansion
│   ├── products.ts                 50 product seeds
│   └── dataset.ts                  Assembly: links, users, audit logs, documents
├── lib/                            Framework-free utilities
│   ├── types.ts                    The domain model
│   ├── validation.ts               Zod schemas + query parsing
│   ├── search-core.ts              Scoring, fuzzy matching, highlighting
│   ├── export.ts                   CSV / Excel / PDF writers, CSV parser
│   ├── format.ts                   Dates, numbers, relative time
│   ├── status.ts                   Product status → badge tone
│   ├── slug.ts
│   └── cn.ts                       Tailwind-aware merge + VBDS cx
├── server/                         Server-only modules
│   ├── repo/                       contract · memory · prisma · store · index
│   ├── auth.ts                     jose sessions, Auth.js-shaped API
│   ├── rbac.ts                     Role → permission map
│   ├── api.ts                      Response envelopes, error mapping
│   └── actions/auth.ts             Sign-in / sign-out Server Actions
├── styles/
│   ├── tokens.css                  ASTRA tokens (VBDS names, ASTRA values, density tier, dark)
│   ├── vbds/                       Ported component CSS
│   ├── astra.css                   App-level compositions
│   └── globals.css                 Tailwind import, @theme bridge, reset
└── middleware.ts                   Edge session presence gate
```

---

## Data layer

### The contract

`src/server/repo/contract.ts` declares ~25 methods covering products, companies, search,
analytics, documents, users and audit. Both adapters implement it in full.

### Memory adapter (default)

Backed by a process-local store on `globalThis` (`src/server/repo/store.ts`), built once per
process from `buildDataset()`. It survives Next.js hot reload, which a module-level `const`
would not.

Everything the Prisma adapter does, this does: filtering, relevance ordering, pagination,
**soft delete**, and audit trailing. Writes persist for the life of the process.

### Prisma adapter

Enabled by `ASTRA_DATA_SOURCE=prisma` + `DATABASE_URL`. Loaded via a lazy `require` so a missing
generated client can never break the default path — `getRepository()` catches the failure, warns,
and falls back to memory.

The client is typed structurally (`PrismaLike`) rather than through the generated types, so
`npm run typecheck` passes before `prisma generate` has ever run. Once you generate, swap
`PrismaLike` for `PrismaClient` to recover full model typing.

### Determinism

The corpus uses a seeded `mulberry32` PRNG and fixed base dates — no `Date.now()`, no
`Math.random()`. Same dataset every boot, and `prisma/seed.ts` produces byte-identical content.
Seed dates are anchored to `SEED_NOW` (2026-07-01) and spread across the preceding 24 months so
the rolling-12-month trend chart has real shape.

---

## Search engine

`src/lib/search-core.ts` is pure and dependency-free, so identical ranking runs on the server
(API routes, RSC) and in the browser (palette, instant filtering).

### Scoring ladder

| Match | Score |
|---|---|
| Exact | 1000 |
| Prefix | 700 − length penalty |
| Word-boundary prefix | 500 − length penalty |
| Substring | 300 − length penalty |
| Fuzzy subsequence | ≤ 120 × quality |

Longer fields carry a light penalty so short, precise fields win ties.

### CAS-aware matching

CAS numbers are compared with separators stripped, so `501531`, `501-53-1` and `50153-1` all
find **Benzyl chloroformate**.

### Fuzzy matching

`subsequenceQuality()` requires the query to be a subsequence of the field and scores it on
character density and gap count, with a head-position bonus. Only queries of 3+ characters
qualify, and only above a 0.32 quality floor — below that, fuzzy matching produces noise.

### Field weighting

Product search weights: name 1.0 · CAS 1.0 · synonyms 0.85 · formula 0.7 · application 0.6 ·
companies 0.55 · description 0.25. Products get a further ×1.1 in unified search — they're the
primary entity.

### Highlighting

`highlight()` returns matched/unmatched segments for `<mark>` rendering. It only highlights
literal substring hits; fuzzy matches render plain, because a highlight scattered across
non-adjacent characters is harder to read than none.

### Scaling past the seed corpus

Both adapters currently rank in memory over the SQL-filtered set. For a large corpus, replace
`scoreMatch` with a Postgres `pg_trgm` similarity index:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX products_cas_trgm  ON products USING gin (cas_number gin_trgm_ops);
```

The structural filters in `prismaRepo.listProducts` already run in SQL, so only the ranking pass
needs replacing.

---

## Authentication

`src/server/auth.ts` issues signed, HttpOnly JWT session cookies via `jose` (HS256, 8-hour
expiry, `SameSite=Lax`, `Secure` in production).

The exported surface — `auth()`, `signIn()`, `signOut()` — matches **Auth.js v5**, so swapping in
`next-auth` means replacing this one module and keeping every call site.

### Migrating to Auth.js or Clerk

1. Replace `src/server/auth.ts` with your provider's `auth()` / `signIn()` / `signOut()`.
2. Keep `requireSession()` and `requirePermission()` — they only need `session.user.role`.
3. Point `middleware.ts` at the provider's cookie name.
4. Populate `users.password_hash` and replace the marked demo credential block.

### Two-stage verification

Middleware performs a cheap **cookie-presence** check on the edge and redirects the obviously
signed-out. It does *not* verify the signature — that happens in `auth()` on the Node runtime, in
the `(app)` layout and in every API route. Middleware is a fast path, never the control.

---

## Authorization (RBAC)

`src/server/rbac.ts` is the single source of truth. Roles are cumulative:

```
VIEWER   product:read, company:read, report:read, settings:read
ANALYST  + product:create, product:update, company:update, report:export
MANAGER  + product:delete, company:create, company:delete, audit:read
ADMIN    + settings:manage, user:manage
```

Enforced in three places, in order of authority:

1. **API routes** — `await requirePermission('product:delete')` throws `ForbiddenError` → 403.
2. **Server components** — `redirect()` when the role lacks the permission (e.g. `/products/new`).
3. **UI** — `can(role, permission)` hides actions the caller cannot perform.

Layer 3 is a courtesy. Hiding a button is not authorization; layers 1 and 2 are the control.

The Settings → Roles page renders its matrix *from* `ROLE_PERMISSIONS`, so the documentation
cannot drift from what is enforced.

---

## Rendering strategy

Server Components by default. Client Components only where interaction demands it — the data
table, wizard, command palette, theme provider, filter controls and chart containers.

### Suspense placement

Each page wraps its data-fetching body in `<Suspense>` with a skeleton that mirrors the loaded
layout. There is deliberately **no route-level `loading.tsx`**: a top-level Suspense boundary
commits a `200` before `notFound()` can throw, turning every missing product into a soft 404.
Per-page boundaries keep streaming *and* correct status codes.

### The Server → Client boundary

Functions cannot cross it. Chart drill-downs therefore carry a serializable `href` string on each
datum (`withHref()` in `chart-theme.ts`) rather than an `hrefFor` callback — that mistake produces
a runtime serialization error, not a type error, so it's worth knowing.

---

## Performance

| Technique | Where |
|---|---|
| Server Components | Every page shell and read path |
| Streaming + Suspense | Dashboard, Search, Products, Companies, Analytics |
| `optimizePackageImports` | lucide-react, recharts, date-fns, TanStack Table |
| Client-side sort/page | Data tables receive the filtered set once; sorting never re-fetches |
| Debounced input | Search 200 ms · palette 140 ms, with `AbortController` to drop stale responses |
| `useTransition` | Filter changes keep the current results visible while the next render streams |
| Dynamic imports | ExcelJS, jsPDF and autotable load only when an export runs |
| Sticky headers, not virtualization | Page size caps at 100 rows; `@tanstack/react-virtual` is installed for when it doesn't |
| `router.replace` for typing | One history entry per search, not one per keystroke |

First-load JS is ~103 kB shared; the heaviest route (Dashboard, with Recharts) is 250 kB.

---

## Security

| Concern | Mitigation |
|---|---|
| **SQL injection** | Prisma parameterizes everything; no raw SQL in the codebase |
| **XSS** | React escapes by default. The one `dangerouslySetInnerHTML` is the theme bootstrap script — a hard-coded constant with no interpolation |
| **CSRF** | Mutations run through Server Actions (Next.js origin check) or `fetch` with `SameSite=Lax` cookies |
| **CSV injection** | `escapeCsv()` prefixes values starting with `= + - @` with an apostrophe so Excel and Sheets don't evaluate them |
| **Session theft** | HttpOnly, `SameSite=Lax`, `Secure` in production, 8-hour expiry, HS256-signed |
| **Privilege escalation** | Every mutating route re-checks permissions server-side |
| **Input validation** | Zod at every boundary, including CAS checksum validation |
| **Clickjacking** | `X-Frame-Options: DENY` |
| **MIME sniffing** | `X-Content-Type-Options: nosniff` |
| **Referrer leakage** | `strict-origin-when-cross-origin` |
| **Data loss** | Soft delete throughout — `deleted_at`, never `DELETE` |
| **Traceability** | Append-only audit log with field-level diffs |

`AUTH_SECRET` must be set in production. The development fallback is a known constant and is
useless as a secret.

---

## Accessibility

- Every interactive element is keyboard reachable; focus rings use a 3 px token ring.
- Skip-to-content link, landmark regions, `aria-current` on active navigation.
- Dialogs and sheets are Radix primitives: focus trap, Escape, return focus, `aria-modal`.
- Tables use `aria-sort`, scoped headers, and captions on chart data tables.
- **Colour is never the only channel.** Capability cells pair a check/dash icon with a text
  label; status badges carry a dot and the status word; every chart has a legend and a table view.
- Charts are `aria-hidden` with the table view as the screen-reader path.
- `prefers-reduced-motion` collapses all durations to 1 ms.
