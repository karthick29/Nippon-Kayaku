# ASTRA

**Chemical intelligence platform for Nippon Kayaku.**

Search chemicals by name, CAS number, synonym, formula, manufacturing capability or **chemical
structure**; trace how each product is made and what depends on it; and manage products, suppliers
and plant capacity in one place. Internal business-team tool — not a storefront.

Built on the **VBDS v2.0 design system** (`~/MyStuff/designsystem`), rebranded to ASTRA and
retuned for desktop density. See [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) for exactly what
was ported and what changed.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

No database, no Docker, no environment file needed. The app boots against a deterministic
in-memory corpus: **50 products · 22 companies · 175 supply links · 15 capability types ·
10 applications · 10 locations · 5 categories · 7 users · 49 chemical structures · 9 synthesis
routes**.

### Signing in

The sign-in page lists the seeded directory — click any account to fill the form. **Any password
of four or more characters works** for a known active email; this is a demo seam, clearly marked
in `src/server/auth.ts`, not a security control.

| Account | Role | What they can do |
|---|---|---|
| Ananya Iyer | Administrator | Everything, including users, roles and audit logs |
| Rahul Menon | Manager | Create/edit/delete products and companies, read audit |
| Priya Sharma | Analyst | Create and edit products, export reports |
| Arjun Nair | Viewer | Read-only |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` — passes with zero errors |
| `npm run check:structures` | Verifies every seed structure against its formula, weight and InChIKey, and every route input's SMILES and CAS — run after editing seed chemistry |
| `npm run lint` | Next.js lint |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:push` | Push `schema.prisma` to PostgreSQL |
| `npm run db:seed` | Seed PostgreSQL with the same corpus the app ships |
| `npm run db:studio` | Prisma Studio |

---

## Switching to PostgreSQL

The app ships with two interchangeable repository adapters behind one interface
(`src/server/repo/contract.ts`). Nothing above the repository knows which is running.

```bash
cp .env.example .env.local
# set DATABASE_URL and ASTRA_DATA_SOURCE=prisma

npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

If the Prisma client can't be loaded, the app logs a warning and falls back to the in-memory
adapter rather than failing to boot.

---

## Pages

| Route | What it is |
|---|---|
| `/dashboard` | Executive overview — 6 KPI tiles, 4 charts, latest products, activity feed, floating search |
| `/search` | eMolecules-style search — hero input, faceted filters, grid/list, match highlighting; **substructure, similarity and exact-structure** modes with matched atoms highlighted |
| `/products` | Enterprise data table — sort, resize, column visibility, bulk edit/delete, CSV/Excel export, CSV import |
| `/products/new` | Three-step wizard — Basic Information → Company Mapping → Review, with autosaving draft and a live structure preview |
| `/products/[slug]` | Product profile — Overview (with structure) · **Companies** · **Synthesis** · Documents · History · Analytics |
| `/products/[slug]/edit` | Single-form editor with field-level audit diff |
| `/companies` | Company table with staffing and capability counts |
| `/companies/[slug]` | Company profile — Overview · Equipment · Products · Capabilities · Analytics |
| `/analytics` | Nine charts across portfolio, footprint and capability depth |
| `/reports` | Six report definitions, live preview, CSV / Excel / PDF export |
| `/settings` | Preferences · Users · Roles & Permissions · Master Data · Audit Logs |

The **Companies tab** on a product is the centre of gravity: 21 columns covering staffing,
every tracked capability, strength, presentation, capital and product codes — with a sticky
company column, per-column resize, and an export that mirrors exactly what's on screen.

The **Synthesis tab** answers *"what is this made from, and what stops if a supplier fails?"* — a
map of inputs and downstream products, route cards with each input's supply (**Single source**,
**No supplier**), and a where-used list that follows chains through intermediates.

---

## Stack

React 19 · Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS v4 · Radix UI ·
TanStack Table · TanStack Query · React Hook Form · Zod · Framer Motion · Recharts ·
Lucide · Prisma · PostgreSQL · jose · RDKit.js (server-side, WASM)

---

## Keyboard

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl K` | Command palette — search + navigation + actions |
| `/` | Open the palette from anywhere you aren't typing |
| `↑` `↓` `↵` | Move through results and open |
| `Esc` | Close any overlay |

---

## Documentation

| Document | Covers |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Folder structure, data layer, search engine, auth, RBAC, performance, security |
| [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) | VBDS port, token mapping, density tier, chart palette validation, deviations |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Entity model, Prisma schema walkthrough, seed data provenance |
| [`docs/API.md`](docs/API.md) | Every REST endpoint, request/response shapes, error envelope |
| [`docs/USER-FLOWS.md`](docs/USER-FLOWS.md) | Information architecture and the main task flows |
| [`CLAUDE.md`](CLAUDE.md) | Conventions and gotchas for anyone (human or agent) working in this repo |

---

## Known limitations

These are deliberate scoping decisions, not oversights:

- **Passwords are not verified.** `signIn()` accepts any password ≥ 4 characters for a known
  active email. The replacement point is marked with a comment block in `src/server/auth.ts`.
- **Documents are metadata only.** The Documents tab lists realistic records; there is no object
  storage behind the download control, and it renders as disabled rather than pretending.
- **Writes are process-local** under the default in-memory adapter — they survive navigation but
  not a server restart. Switch to Prisma for durability.
- **Company create/edit has an API and repository path but no dedicated UI form** — companies are
  seeded and read-only in the interface. Products have the full create/edit/delete UI.
- **Import accepts CSV**, including Excel's "Save as CSV". Native `.xlsx` parsing on import is not
  wired up; export produces real `.xlsx` via ExcelJS.
- **Seeded synthesis routes are unreviewed.** The nine routes summarise established literature
  processes and are marked *Awaiting chemist review* until a chemist confirms them.
- **Structure queries are typed, not drawn.** Search and the product forms take SMILES (and SMARTS
  for substructure search); there is no drawing editor.
- **Structure search compares every structure in memory** — milliseconds for this catalogue. A
  large corpus should move matching into PostgreSQL with the RDKit cartridge; see
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#scaling-structure-search).
- **Where-used is only as complete as the routes.** It follows recorded routes; a product with no
  recorded route contributes no edges.
