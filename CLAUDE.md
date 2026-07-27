# CLAUDE.md

Working notes for this repo. Read this before making changes.

---

## What ASTRA is

Internal chemical intelligence platform for Nippon Kayaku. Business teams search chemicals and
manage products, suppliers and manufacturing capability. **Not** an eCommerce site — there are no
prices, carts or checkout, and there should never be.

Runs with `npm run dev` and no configuration. Zero-setup is a feature; don't add a required
environment variable without a fallback.

---

## Three decisions that shape everything

These were confirmed with the user before the build and shouldn't be quietly reversed:

1. **ASTRA blue `#2563EB`** applied through the VBDS token architecture — not VelPOS orange.
2. **VBDS components vendored** into `src/components/vbds/`, plus a desktop density tier, plus
   Radix only for primitives VBDS lacks. Not a shadcn/ui rewrite.
3. **In-memory adapter is the default**; the full Prisma/PostgreSQL schema ships as a deliverable
   behind the same repository interface.

---

## Non-obvious things that will bite you

### 1. `hrefFor` callbacks cannot cross the Server→Client boundary
Chart data flows from Server Components into `MagnitudeBars` (a Client Component). A function
prop produces a **runtime** serialization error, not a type error. Attach a serializable `href`
string to each datum instead — use `withHref()` / `withCompanyHref()` from
`components/charts/chart-theme.ts`.

### 2. There is deliberately no route-level `loading.tsx` in `(app)/`
A top-level Suspense boundary commits a `200` before `notFound()` can throw, so every missing
product becomes a soft 404. Each page has its own `<Suspense>` instead. **Don't add
`(app)/loading.tsx`** — it silently breaks 404 status codes.

### 3. `key` is a reserved React prop
`ProductCompaniesTable` passes `equipmentKey`, not `key`, to `EquipmentCell`. Naming it `key`
means the prop never arrives.

### 4. Seed dates are anchored to `SEED_NOW` (2026-07-01)
`REFERENCE_YEAR` / `REFERENCE_MONTH` in `data/products.ts` and `data/companies.ts` must stay in
sync with `SEED_NOW` in `data/dataset.ts`. If they drift, the rolling-12-month trend chart goes
flat at zero — which looks like a chart bug but is a data bug.

### 5. The corpus must stay deterministic
No `Date.now()`, no `Math.random()` in `src/data/`. Use the seeded `mulberry32` PRNG. The
in-memory adapter and `prisma/seed.ts` are supposed to produce identical content.

### 6. The store lives on `globalThis`
`src/server/repo/store.ts` does this so writes survive hot reload. A module-level `const` would
reset on every edit.

---

## Conventions

### CSS class prefixes
| Prefix | Meaning |
|---|---|
| `vbds-*` | Design system component — restyle only through tokens, never from a page |
| `astra-*` | App-level composition with no design system equivalent |

Both use `--vbds-*` tokens exclusively. **There are no hard-coded colours, radii or shadows in
`astra.css`** — keep it that way.

### Token names are VBDS names
`src/styles/tokens.css` keeps every variable name from the design system and changes only the
values. That's what lets a component copied from `~/MyStuff/designsystem/src` drop in unchanged.
Don't rename tokens to `--astra-*` except for genuinely app-specific geometry
(`--astra-sidebar-width`, `--astra-topbar-height`, `--astra-row-height`).

### Icons
Lucide only. VBDS component props take `ReactNode`, not Material Symbols strings:
`icon={<Plus size={14} />}`.

### Data access
Pages import `repo` from `@/server/repo`. **Never import an adapter directly.** If you add a
method, add it to `contract.ts` and implement it in *both* `memory.ts` and `prisma.ts`.

### Validation
Zod schemas in `lib/validation.ts` are shared between React Hook Form and the API routes. Add a
field there, not in two places. CAS numbers are checksum-validated, not just pattern-matched.

### Authorization
`server/rbac.ts` is the single source of truth. Three layers, in order of authority:
API route (`requirePermission`) → server component (`redirect`) → UI (`can`). The UI check is a
courtesy; hiding a button is not authorization.

---

## Charts — read before touching

The categorical palette is **validated, not chosen**. It was run through the dataviz validator in
both light and dark modes; the first attempt failed (brand blue vs indigo were ΔE 1.9 apart under
protanopia). See `docs/DESIGN-SYSTEM.md § Chart palette`.

Rules that follow from the validation:

- Assign hues in **fixed order, never cycled**. A ninth series folds into "Other".
- **All-pairs forms (donut, scatter) cap at 3 series** — only the first three slots clear the
  all-pairs floors in both modes. This is why "Products by Status" is a stacked bar, not a donut.
- Light-mode slots 3/4/5 fall below 3:1 contrast, so **every chart ships visible value labels and
  a table view**. `ChartCard`'s table toggle is the accessibility relief, not decoration.
- **Never a dual axis.**
- Magnitude comparisons use a single hue with direct labels — identity comes from the row label.

If you change `--vbds-chart-*`, re-run the validator before committing.

---

## Commands

```bash
npm run dev          # zero-config dev server
npm run build        # must compile with no errors and no warnings
npm run typecheck    # must pass with zero errors
```

Both `typecheck` and `build` are currently clean. Keep them that way.

---

## Where things live

| Need | Path |
|---|---|
| Domain types | `src/lib/types.ts` |
| Seed corpus | `src/data/` |
| Repository contract | `src/server/repo/contract.ts` |
| Search scoring | `src/lib/search-core.ts` |
| Zod schemas | `src/lib/validation.ts` |
| RBAC map | `src/server/rbac.ts` |
| Design tokens | `src/styles/tokens.css` |
| Chart rules | `src/components/charts/chart-theme.ts` |
| Source design system | `~/MyStuff/designsystem/src` |

---

## Deliberate gaps

Don't "fix" these without asking — they're scoped decisions, and the README states them plainly:

- **Passwords aren't verified.** Any password ≥ 4 chars works for a known active email. The
  replacement point is marked with a comment block in `src/server/auth.ts`.
- **Documents are metadata only.** No object storage; the download control renders disabled
  rather than pretending to work.
- **Companies have API + repository write paths but no create/edit UI.** Products have the full
  wizard/edit/delete UI.
- **Import accepts CSV**, not native `.xlsx`. Export produces real `.xlsx` via ExcelJS.
