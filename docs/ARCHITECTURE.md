# Architecture

## Contents

1. [Layering](#layering)
2. [Folder structure](#folder-structure)
3. [Data layer](#data-layer)
4. [Search engine](#search-engine)
5. [Chemistry engine](#chemistry-engine)
6. [Synthesis graph](#synthesis-graph)
7. [Authentication](#authentication)
8. [Authorization (RBAC)](#authorization-rbac)
9. [Rendering strategy](#rendering-strategy)
10. [Performance](#performance)
11. [Security](#security)
12. [Accessibility](#accessibility)

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
│   │   │       ├── page.tsx        Six tabs
│   │   │       ├── SynthesisTab.tsx   Made from · Used in · supply-risk callout
│   │   │       ├── SynthesisMap.tsx   Server-rendered SVG map
│   │   │       ├── RouteEditor.tsx    Add / edit / remove routes (client)
│   │   │       └── edit/
│   │   ├── companies/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/             Five tabs
│   │   ├── analytics/
│   │   ├── reports/
│   │   └── settings/               Layout + nav + 5 sub-pages
│   └── api/                        REST route handlers (incl. structure/, routes/)
├── components/
│   ├── vbds/                       Design system port (actions, inputs, display, navigation, feedback, overlays)
│   ├── charts/                     ChartCard, MagnitudeBars, StatusStack, TrendChart, chart-theme
│   ├── data-table/                 Generic TanStack DataTable
│   ├── search/                     Highlight, ProductResultCard
│   ├── chem/                       StructureImage (server), StructureSvg, StructureField (client)
│   ├── shell/                      AppShell, Sidebar, Topbar, CommandPalette, ThemeProvider, Logo
│   └── page/                       PageHeader, Stack
├── data/                           Deterministic seed corpus
│   ├── masters.ts                  Applications, categories, locations, equipment master
│   ├── companies.ts                22 company seeds + equipment expansion
│   ├── products.ts                 50 product seeds, with SMILES + InChIKey
│   ├── routes.ts                   9 synthesis route seeds, referenced by CAS
│   └── dataset.ts                  Assembly: links, users, audit logs, documents, routes
├── lib/                            Framework-free utilities
│   ├── types.ts                    The domain model
│   ├── validation.ts               Zod schemas + query parsing
│   ├── search-core.ts              Scoring, fuzzy matching, highlighting
│   ├── formula.ts                  Parse / compare molecular formulae (Hill order)
│   ├── synthesis.ts                Route graph, where-used BFS, loop check, map layout
│   ├── export.ts                   CSV / Excel / PDF writers, CSV parser
│   ├── format.ts                   Dates, numbers, relative time
│   ├── status.ts                   Product status → badge tone
│   ├── slug.ts
│   └── cn.ts                       Tailwind-aware merge + VBDS cx
├── server/                         Server-only modules
│   ├── repo/                       contract · memory · prisma · store · index
│   ├── chem/                       RDKit loader, depiction, structure input, structure search
│   ├── synthesis.ts                Route write rules shared by both adapters
│   ├── synthesis-map.ts            Gathers upstream routes for the map
│   ├── route-request.ts            Parses + canonicalises route request bodies
│   ├── field-error.ts              throwFieldError() — server-decided 422s
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

scripts/check-structures.ts         Offline verification of every seed structure
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

## Chemistry engine

Structures are handled by **RDKit.js** (`@rdkit/rdkit`, WASM, BSD-3) — on the **Node runtime
only**. The browser never downloads the 7 MB binary: depictions arrive as SVG, and the form preview
calls `/api/structure/depict`.

### Loading

`loadRDKit()` in `src/server/chem/rdkit.ts` initialises the module once per process and keeps the
promise on `globalThis` (the same reason as the store: a module-level value reloads on every hot
edit). A failed load isn't cached, so the next call retries. `@rdkit/rdkit` is listed in
`serverExternalPackages` so it is required from `node_modules` at runtime and finds its `.wasm`
next to its JS; `outputFileTracingIncludes` copies the binary into the standalone build.

### Memory

Every RDKit `Mol` lives on the WASM heap and must be freed with `.delete()`. Use `withMol()`,
which frees in a `finally`; never call `get_mol` bare.

### Canonical input

`resolveStructureInput()` turns user SMILES into what is stored: RDKit canonical SMILES plus its
InChIKey. It runs in the API layer, not in the Zod schema, because the schema also runs in the
browser. The schema only checks shape (length, no stray spaces).

### Depiction

`depictStructure()` draws with no background, then rewrites every colour to `currentColor` and a
sentinel highlight colour to `var(--vbds-primary-border)`. The structure therefore takes the
surrounding text colour and themes in light and dark mode without new colour tokens. Bond length
is capped relative to the box so a four-atom molecule isn't drawn giant beside a forty-atom one.

### Structure search

`runStructureSearch()` (`src/server/chem/structure-search.ts`) is shared by both adapters.
Candidates come from the adapter's own `listProducts` — paged through, so the 200-row cap can't
drop any — which means facet filters behave exactly as in text search.

| Mode | Method |
|---|---|
| Substructure | `get_substruct_matches`; query read as SMILES first, then SMARTS. Score = share of the product's heavy atoms covered. All matches highlighted |
| Similarity | Tanimoto on Morgan fingerprints (r = 2, 2048 bits), popcount over packed bytes. Fingerprints cached on `globalThis` by canonical SMILES |
| Exact | Full InChIKey match; first-block match reported as *same connectivity* |

At catalogue scale a query is 10–25 ms (50 000 substructure matches take ~100 ms).

### Scaling structure search

Every query compares every in-scope structure. For a large corpus, move matching into
PostgreSQL with the **RDKit cartridge**:

```sql
CREATE EXTENSION IF NOT EXISTS rdkit;
ALTER TABLE products ADD COLUMN mol mol;
UPDATE products SET mol = mol_from_smiles(smiles::cstring) WHERE smiles IS NOT NULL;
CREATE INDEX products_mol_gist ON products USING gist (mol);
-- substructure: WHERE mol @> 'c1ccccc1'::qmol
-- keep `mol` in step with `smiles` on every product write
```

Prisma can't model the `mol` type; declare it `Unsupported("mol")` and query it with `$queryRaw`.

---

## Synthesis graph

A synthesis route lists inputs; every input that is a catalogue product is an edge
**input → output**. `src/lib/synthesis.ts` holds the graph logic, framework-free so both
adapters and the UI share it.

| Function | Does |
|---|---|
| `routeEdges()` | Live routes → edges. External substances are leaves, not edges |
| `traceConsumers()` | Where-used. Breadth-first, so each consumer appears once at its **shortest** chain, with the intermediates in `via`. Never loops, even on cyclic data |
| `findCycle()` | Would a new route close a loop? True when the output is already used, transitively, to make one of its inputs |
| `buildSynthesisMap()` / `layoutSynthesisMap()` | The diagram: preferred routes upstream and where-used downstream, up to 3 steps each way; layered columns with one barycentre sweep to reduce crossings |

**Write rules** live in `assertRouteWritable()` (`src/server/synthesis.ts`), called by both
adapters: inputs must be active catalogue products, a product can't be its own input, and no route
may form a loop. Each failure is a 422 pointed at the input row. When editing, the route being
replaced is excluded from the edge set, so it is never mistaken for a loop with its old self.

**Supply risk** is derived, not stored: a catalogue input's mapped supplier count from
`product_company` — 0 = no supplier, 1 = single source.

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
| Server-side chemistry | RDKit's 7 MB WASM stays on the server; pages receive SVG |
| Cached fingerprints | Morgan fingerprints held on `globalThis`, keyed by canonical SMILES |
| Debounced structure input | Structure search 600 ms (a half-typed SMILES is usually invalid) |
| Sticky headers, not virtualization | Page size caps at 100 rows; `@tanstack/react-virtual` is installed for when it doesn't |
| `router.replace` for typing | One history entry per search, not one per keystroke |

First-load JS is ~103 kB shared; the heaviest route (Dashboard, with Recharts) is 250 kB.

---

## Security

| Concern | Mitigation |
|---|---|
| **SQL injection** | Prisma parameterizes everything; no raw SQL in the codebase |
| **XSS** | React escapes by default. Two `dangerouslySetInnerHTML` uses: the theme bootstrap script (a hard-coded constant), and structure depictions in `StructureSvg`. Depictions are generated by RDKit on the server from a *parsed* molecule — RDKit draws labels as paths and never echoes input text (verified against CXSMILES label injection) — and `depictStructure()` refuses any output containing script-capable markup as a backstop |
| **CSRF** | Mutations run through Server Actions (Next.js origin check) or `fetch` with `SameSite=Lax` cookies |
| **CSV injection** | `escapeCsv()` prefixes values starting with `= + - @` with an apostrophe so Excel and Sheets don't evaluate them |
| **Session theft** | HttpOnly, `SameSite=Lax`, `Secure` in production, 8-hour expiry, HS256-signed |
| **Privilege escalation** | Every mutating route re-checks permissions server-side |
| **Input validation** | Zod at every boundary, including CAS checksum validation; structures re-parsed by RDKit on the server |
| **Expensive chemistry input** | SMILES/SMARTS capped at 1000 characters and 150 query atoms |
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
- Structure depictions are `role="img"` with the substance name as their label.
- The synthesis map has an SVG `<title>`/`<desc>` summary, linked nodes reachable by keyboard,
  and encodes external substances and supply risk in each node's text as well as its outline.
  The Made from / Used in tables carry the same information.
- `prefers-reduced-motion` collapses all durations to 1 ms.
