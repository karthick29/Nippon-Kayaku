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
reset on every edit. The corollary: after changing anything in `src/data/`, **restart the dev
server** — the old store survives hot reload, so new seed data won't appear.

### 7. RDKit runs on the server, and every `Mol` must be freed
`src/server/chem/rdkit.ts` loads RDKit.js (WASM) once per process. Each `Mol` is WASM heap memory
the garbage collector can't see — use `withMol()`, never a bare `get_mol()` without
`.delete()`. `@rdkit/rdkit` must stay in `serverExternalPackages` in `next.config.ts`, or it
can't find its `.wasm` at runtime; never import it into a Client Component.

### 8. Seed chemistry is verified — don't hand-type it
Product SMILES were sourced from PubChem by CAS and checked by InChIKey, formula and weight. After
any change to `src/data/products.ts` or `src/data/routes.ts`, run `npm run check:structures`.
Formula agreement alone **does not** catch a wrong enantiomer; the InChIKey check does. Take a
molecule's formula from its atoms (`hillFormula`), not its InChI — InChI neutralises salts.

### 9. Prisma master data must keep its fixed ids
`prisma/seed.ts` creates applications, categories and locations with their `src/data/masters.ts`
ids (`app-pharma-agro`…), because forms and filters use those ids in both adapters. Let them
default to cuids and product creates fail their foreign key on PostgreSQL — silently fine on the
in-memory default, which is how it went unnoticed.

### 10. SVG `<title>` / `<desc>` take a single string
Mixed JSX children (`{a} — {b}`) put text separators inside them and cause a hydration mismatch
that only shows in the browser. Use a template literal.

### 11. The structure editor (Ketcher) loads only through `StructureEditorDialog`
`src/components/chem/KetcherCanvas.tsx` pulls ~3.3 MB (gzip) of editor and Indigo WASM and touches
`window` on import. Never import it statically — `StructureEditorDialog` `import()`s it on first open,
so pages that never open the editor never download it. The `webpack()` block in `next.config.ts`
aliases paper.js's Node shim (and `jsdom`, `canvas`, `acorn`) to `false` for **every** build: Next
ignores paper's `browser` field, and even client-only code is compiled for the server pass. Remove it
and the editor fails to compile. If you switch the dev server to Turbopack, port that alias to
`turbopack.resolveAlias` first.

Five rules that came out of review — each one fixed a real failure:

- **One editor per page, parked between opens.** Ketcher never removes its document/window
  listeners; mounting a fresh one per open leaked ~800 listeners each time. `KetcherCanvas` mounts it
  once into a detached host element and the dialog attaches/parks it. It must be parked at a real size
  in the document (not `remove()`d, not `display:none`) — a detached tree makes Ketcher's ruler throw
  "Could not resolve relative length" and unmount itself. The dialog tracks its canvas element as
  **state**, not a ref: Radix mounts the content a render after `open` flips.
- **Load as a molfile, not a SMILES string.** `GET /api/structure/molfile` (`molfileFor`) gives
  Ketcher an RDKit 2D molfile with "either" bonds for unspecified double bonds and the absolute-stereo
  flag. Ketcher's own SMILES import invents E/Z geometry (456/465 vs 427/473 test structures
  round-trip identically). An untouched drawing is applied as the original string, never re-derived.
- **RDKit limits are measured.** `MAX_STRUCTURE_LENGTH` is 400: an unbranched ~650-atom chain
  overflows the WASM stack (a trap, not an exception). Traps are caught in `withMol` and
  `runStructureSearch`, the shared module is reloaded, and the caller gets a 422 — never a 500 and
  never a poisoned server. CoordGen (`set_new_coords(true)`) never returns on a 40-membered ring and
  blocks the event loop, so `molfileFor` uses RDKit's own depictor when the molecule has a ring of
  30+ atoms. Re-run the fuzz (`scratchpad`-style: one child process per input) before raising either.
  `recoverFromTrap` treats a `RangeError` as a trap too: when the JS stack runs out first, V8 unwinds
  through RDKit's frames and the module is just as poisoned.
- **Never trust `getSmiles()` to refuse.** Ketcher writes *something* for any drawing: an atom list
  `[C,N]` comes back as `*`, an "any" bond as a single bond, an R-group as `[*:1]` — no error. The
  dialog reads the drawing as KET first (`inspectDrawing` in `lib/drawing.ts`): query features go out
  as SMARTS when `allowQuery`, and are refused by name otherwise. The result then goes through
  `GET /api/structure/check` (RDKit) before the dialog closes, so a bad drawing fails while it can
  still be fixed. After touching any of this, run `npm run check:drawing`.
- **"Changed" is a content comparison, not the undo position.** `setMolecule` records the load as an
  undo step, so undo-then-draw lands back on the starting `historyPtr` — the old check called that
  drawing untouched and applied the *original* string. The dialog compares KET fingerprints, and
  `loadStructure` clears the history *after* loading so Ctrl/⌘ Z can't wipe the opened structure.
  Only Ketcher's typed API is used (`editor.clear`, `clearHistory`, `getKet`) — no private fields.

- **Opening a file: never trim it, and don't expect an error.** A molfile's first three lines are
  positional and the first is often blank — `trim()` makes Ketcher reject it. And `setMolecule` on
  text it can't read neither throws nor calls `errorHandler` (3.18): the canvas is just left as it
  was. `openFile` therefore compares KET fingerprints before and after. The analysis strip
  (`GET /api/structure/properties`, `structureProperties`) is advisory — it must never gate or
  alter what *Use structure* returns.

- **Reactions are drawn, never stored.** A route is still a list of inputs with roles; the scheme
  on the Synthesis tab (`ReactionScheme`) is drawn from them. *Draw reaction* in the route editor
  opens the same editor with `onApplyReaction`; `GET /api/structure/reaction` (`parseReaction`)
  reads the reaction SMILES into inputs and the string is thrown away. The arrow and "+" tools are
  therefore **not** in `HIDDEN_BUTTONS` — the button set is fixed when the one editor is created —
  and are hidden by CSS unless the host has `data-reactions`. Everywhere else a reaction is still
  refused. Reaction SMILES can't say two fragments are one substance, so charged fragments that
  balance on a side are regrouped (`[Na+].[OH-]` stays one input).
- **Name lookup is catalogue-only by default.** `GET /api/structure/lookup` matches product name,
  synonym or CAS exactly. OPSIN (an outside service) is used only when `ASTRA_NAME_LOOKUP=opsin`
  is set, because it sends the typed name off the server. Don't make that the default.

### 12. `.astra-table` truncates by design
Its cells use `max-width: 0` + ellipsis so dense grids stay one line. For tables where the
text *is* the point (chemical names), add `.astra-table--wrap`; don't change the base rule.

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
Logic both adapters need (structure search, route write rules, the synthesis graph) lives in one
shared module that each adapter calls — so the two backends can't enforce different rules.

### Validation
Zod schemas in `lib/validation.ts` are shared between React Hook Form and the API routes. Add a
field there, not in two places. CAS numbers are checksum-validated, not just pattern-matched.
Checks that need the server (does this SMILES parse? would this route form a loop?) throw
`throwFieldError(path, message)` — same 422 envelope, so forms show them under the right field.

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
npm run check:structures  # after editing seed chemistry — must pass
npm run check:drawing     # after editing lib/drawing.ts or the editor dialog — must pass
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
| RDKit, depiction, structure search | `src/server/chem/` |
| Formula parsing / Hill order | `src/lib/formula.ts` |
| Reading a drawing (KET), SMARTS detection | `src/lib/drawing.ts` |
| Synthesis graph, where-used, map layout | `src/lib/synthesis.ts` |
| Route write rules (both adapters) | `src/server/synthesis.ts` |
| Seed routes | `src/data/routes.ts` |
| Seed structure verification | `scripts/check-structures.ts` |
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
- **Seeded synthesis routes are `unreviewed`.** They summarise literature processes; a chemist
  marks them reviewed. Don't flip them in the seed.
- **Import accepts CSV**, not native `.xlsx`. Export produces real `.xlsx` via ExcelJS.
