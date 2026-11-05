# Data model

## Entity relationships

```
                    ┌────────────┐        ┌──────────────────┐
                    │   roles    │◄───────│ role_permissions │───────►┌─────────────┐
                    └─────┬──────┘        └──────────────────┘        │ permissions │
                          │                                           └─────────────┘
                          │ 1:N
                    ┌─────▼──────┐
                    │   users    │──────┬──────────────► audit_logs
                    └────────────┘      ├──────────────► activity_logs
                                        ├──────────────► documents
                                        └──────────────► saved_searches

┌──────────────┐      ┌──────────────┐      ┌────────────────────┐
│ applications │──1:N─│              │      │ product_categories │
└──────────────┘      │   products   │─N:1──┘
                      │              │
                      └──────┬───────┘
                             │ 1:N
                      ┌──────▼─────────┐
                      │ product_company│  ← the join that carries product codes,
                      └──────┬─────────┘    strength, presentation and capital
                             │ N:1
                      ┌──────▼───────┐      ┌───────────────────┐
                      │  companies   │─N:1──│ company_locations │
                      └──────┬───────┘      └───────────────────┘
                             │ 1:N
                    ┌────────▼──────────┐      ┌──────────────────┐
                    │ company_equipment │─N:1──│ equipment_master │
                    └───────────────────┘      └──────────────────┘

products ──1:N──► product_versions   (append-only snapshots, History tab)
products ──1:N──► documents
companies ─1:N──► documents

                      ┌──────────────┐  1:N  ┌──────────────────┐  1:N  ┌──────────────┐
                      │   products   │──────►│ synthesis_routes │──────►│ route_inputs │
                      └──────▲───────┘       └──────────────────┘       └──────┬───────┘
                             │                     "how P is made"             │
                             └──────────── N:0..1 ─────────────────────────────┘
                               an input is a catalogue product (product_id)
                               OR an external substance (external_* columns)
```

Read the synthesis tables as a graph: every `route_inputs` row with a `product_id` is an edge
*input → output* ("X is used to make P"). Walking those edges forwards gives **where-used**;
walking a route's inputs backwards gives **made from**. External substances are leaves — they
carry a name, CAS and SMILES but are not catalogue products, because most real precursors aren't.

## Tables

| Table | Purpose | Key columns |
|---|---|---|
| `roles` | ADMIN / MANAGER / ANALYST / VIEWER | `key`, `rank` |
| `permissions` | Dot-scoped capabilities, e.g. `product:delete` | `key`, `resource`, `action` |
| `role_permissions` | Many-to-many join | composite PK |
| `users` | Accounts | `email` unique, `role_id`, `password_hash`, `deleted_at` |
| `applications` | 10 chemical applications | `name`, `slug`, `color_key` |
| `product_categories` | 5 categories | `name`, `slug` |
| `company_locations` | 10 manufacturing cities | `name`, `state`, `country`, `region` |
| `equipment_master` | 15 capability types | `key`, `group`, `value_type`, `unit` |
| `products` | The catalogue | `cas_number`, `smiles`, `inchi_key`, `application_id`, `category_id`, `status`, `synonyms[]` |
| `product_versions` | Append-only snapshots | `product_id`, `version`, `snapshot` JSON |
| `companies` | Manufacturing partners | `location_id`, `chemical_staff`, `phd_count`, `established` |
| `company_equipment` | Per-company capability rows | `available`, `count`, `specification`, `capacity` |
| `product_company` | Which company supplies which product | `product_codes[]`, `strength`, `presentation`, `capital` |
| `synthesis_routes` | One way to make a product; several per product, at most one preferred | `product_id`, `is_preferred`, `review_status`, `notes`, `deleted_at` |
| `route_inputs` | One input to a route — a catalogue product or an external substance | `route_id`, `role`, `product_id` *or* `external_name` / `external_cas` / `external_smiles`, `quantity` |
| `documents` | COA / MSDS / spec sheets | polymorphic to product or company |
| `audit_logs` | Immutable change trail | `action`, `entity`, `changes` JSON diff |
| `activity_logs` | Usage feed (views, searches, exports) | prunable |
| `saved_searches` | Named queries | `filters` JSON |

## Schema conventions

- **snake_case** columns via `@map`, PascalCase models.
- **cuid()** primary keys — except master data. `applications`, `product_categories` and
  `company_locations` are seeded with their **fixed ids** (`app-pharma-agro`, `cat-reagent`,
  `loc-hosur`…) because the forms, facet filters and command palette read those ids from
  `src/data/masters.ts` in both adapters. Seed them with cuids and every product create fails its
  foreign key and every master-data filter matches nothing.
- **Soft delete** — `deleted_at` on every business entity. Nothing is ever hard-deleted.
- **Explicit `onDelete`** on every FK: `Cascade` for owned children, `Restrict` for master data
  in use, `SetNull` for actor references so deleting a user never destroys an audit entry.
- **Indexes** on every column used for filtering, sorting or joining, plus composites where
  queries pair them (`equipment_id, available`).
- **`@@unique([casNumber, deletedAt])`** — one active product per CAS number, while still
  allowing soft-deleted rows to keep the same CAS.
- **`@@unique([productId, companyId])`** — a company can't be linked to the same product twice.
- **`inchi_key` is indexed but not unique** — a pure substance and its 50% solution are separate
  products with the same structure. CAS stays the uniqueness key.
- **`route_inputs`: exactly one of `product_id` / `external_name`.** Prisma can't express the
  check, so `routeInputSchema` enforces it; add a `CHECK` constraint in a migration if anything
  writes outside the API.
- **No synthesis loops.** A route may not use a product that is already made, directly or
  transitively, from its own output. Enforced on every write by `assertRouteWritable` in
  `src/server/synthesis.ts`, shared by both adapters.
- **`molecular_weight`** is `Decimal(10,4)`, not float — a float would silently drift on repeated
  reads of a value chemists treat as exact.

## Value types on capabilities

`equipment_master.value_type` tells the UI how to read a `company_equipment` row:

| Type | Reads from | Renders as | Example |
|---|---|---|---|
| `count` | `count` | Number, or a dash at zero | Fume Hoods: `12` |
| `spec` | `specification` | Text, truncated with tooltip | Autoclave: `500 mL, 2 L` |
| `boolean` | `available` | Check + "Yes", or dash + "Not available" | Flow Chemistry: `Yes` |

This is why one table can hold "12 hoods", "100 L Glass" and "yes/no" without three schemas.

## Chemical structures

`products.smiles` holds an **RDKit canonical SMILES**; `inchi_key` is the Standard InChIKey derived
from it. Both are set by the API (`resolveStructureInput`), never stored as typed — so the same
molecule always has the same string, whatever form it was entered in.

| Situation | What `smiles` holds |
|---|---|
| Pure substance | The substance |
| Solution or formulation (*Benzyl chloroformate, 50% in toluene*) | The **active substance** only |
| Salt or complex (Pd(OAc)₂, LDA, TMAH) | The ionic form, as PubChem records it |
| Organometallic SMILES represents poorly (XPhos Pd G3) | Nothing — no structure is better than a misleading one |

The formula shown from a structure is **counted from its atoms**, not read from the InChI: InChI
neutralises charged components, so Pd(OAc)₂ would come out as two acetic acids plus Pd — two
hydrogens too many.

---

## Seed corpus

| Entity | Count |
|---|---|
| Products | 50 |
| Companies | 22 |
| Product ⇄ company links | 175 |
| Applications | 10 |
| Categories | 5 |
| Locations | 10 |
| Equipment types | 15 |
| Company equipment rows | 330 |
| Users | 7 |
| Documents | ~60 |
| Audit entries | 40 |
| Products with a structure | 49 |
| Synthesis routes | 9 |
| Route inputs | 31 (3 catalogue products, 28 external substances) |

Brief minimums were 20 companies, 50 products, 5 categories, 10 applications, 10 locations — all met.

### Provenance of the four named companies

The brief supplied four companies as raw rows. Two were **column-misaligned** and two were
**sparse**, so they were normalised onto the canonical column set. Every value present in the
source is preserved; gaps are filled with plausible values, listed below so the distinction stays
visible.

**Arkgen** — Bangalore · 15 staff · 2 PhD · est. 2014 · 12 hoods · autoclave `500 mL, 2 L` ·
flow chemistry No · kilo lab `100 L Glass` · rotavapor `10 cm` · 3 open reaction · 2 HPLC ·
0 GC · capital `$1M` · code `PR-001`.
The source row ran one column short from "MS" onward. MS, Prep HPLC and NMR are recorded as
not available. `Strength` and `Presentation` in the source were the literal words "Strength" and
"OK" — `Presentation: OK` is preserved verbatim; `Strength` was given a descriptive value.

**DSK InnoSciences** — Hosur · 80 staff · 7 PhD · est. 2013 · 75 hoods ·
autoclave `100 mL, 250 mL, 500 mL` · flow No · kilo lab `20 L` · 4 rotavapor · 6 open reaction ·
2 HPLC · 2 GC · 1 MS · NMR `400 MHz` · strength `Polymer synthesis` · code `PR-002`.
Read positionally; `400 MHz` clearly belongs to NMR and `Polymers synthesis` to Strength.

**Sravathi Advance Process Technologies** — Bangalore · 50 staff · 3 PhD · est. 2019 · 50 hoods ·
flow chemistry **Yes** · strength `Flow Chemistry` · codes `PR-003`, `PR-004`.
Source gave only these fields; the remaining capabilities are inferred from a
continuous-flow specialist of this size.

**Gomti Research and Pharmachem** — Bangalore · 10 staff · est. 1997 · 3 hoods · pilot plant ·
incineration facility · code `PR-005`.
The source carried no PhD count; recorded as 1.

All four are linked to **Benzyl chloroformate (50% in toluene)**, CAS **501-53-1**, application
**Pharma and Agro Intermediate**, status **Commercial** — exactly as the brief specifies.

### The other 18 companies and 49 products

Generated to the same shape. Products are real industrial chemicals with **correct, checksum-valid
CAS numbers** (verified by `isValidCasChecksum`) — Boc anhydride 24424-99-5, DMAP 1122-58-3,
TMAH 75-59-2, and so on. Companies follow the Indian CDMO landscape across Bangalore, Hosur,
Hyderabad, Chennai, Cuddalore, Visakhapatnam, Pune, Mumbai, Vadodara and Ankleshwar.

### Structures

All 49 structures were sourced from **PubChem by CAS number**, then checked three ways: RDKit's
InChIKey for the stored SMILES matches PubChem's; the element counts match the seed formula; the
molecular weight matches to within 0.1. The InChIKey check is the one that matters for
stereochemistry — (S)- and (R)-epichlorohydrin share a formula, not a key.

That check found one seed error, since corrected: **XPhos Pd G3** was recorded as
`C42H51N2O3PPdS`, which doesn't match its own molecular weight; it is `C46H62NO3PPdS` (846.45).

`npm run check:structures` re-runs the checks offline. Run it after editing any seed structure.

### Synthesis routes

Nine routes for established literature and industrial processes — Chlorpyrifos, BADGE, CDMT,
XPhos Pd G3, 2,4-D, trimethylsulfoxonium iodide, Boc₂O, 4-aminoazobenzene and ethyl
4-chloroacetoacetate. Every one is seeded **`unreviewed`**: they are plausible summaries, not
process documentation, and a chemist should confirm each before it's relied on.

- Routes reference products **by CAS**, never by position, so reordering `products.ts` can't
  silently rewire one; an unknown CAS throws at build time.
- All 26 distinct external substances were verified against PubChem by CAS.
- The BADGE route deliberately uses **racemic** epichlorohydrin (106-89-8), not the catalogue's
  (S)-enantiomer — that is what the industrial process uses.
- Only three inputs are themselves catalogue products (3,5,6-trichloro-2-pyridinol, sodium
  methoxide, palladium(II) acetate), so where-used chains in the seed are one step deep. That is
  the honest shape of these 50 products; the tracing handles any depth.

### Determinism

A seeded `mulberry32` PRNG and fixed base dates — no `Date.now()`, no `Math.random()`. The
in-memory adapter and `prisma/seed.ts` produce identical content, so screenshots, tests and the
database always agree.

Dates are anchored to `SEED_NOW` (2026-07-01):
- `products.created_at` spreads across the 24 months ending June 2026.
- `companies.created_at` (ASTRA onboarding, distinct from `established`) spreads the same way.
- This is what gives the rolling-12-month trend chart real shape instead of a flat zero line.
