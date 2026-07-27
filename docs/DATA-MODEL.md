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
```

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
| `products` | The catalogue | `cas_number`, `application_id`, `category_id`, `status`, `synonyms[]` |
| `product_versions` | Append-only snapshots | `product_id`, `version`, `snapshot` JSON |
| `companies` | Manufacturing partners | `location_id`, `chemical_staff`, `phd_count`, `established` |
| `company_equipment` | Per-company capability rows | `available`, `count`, `specification`, `capacity` |
| `product_company` | Which company supplies which product | `product_codes[]`, `strength`, `presentation`, `capital` |
| `documents` | COA / MSDS / spec sheets | polymorphic to product or company |
| `audit_logs` | Immutable change trail | `action`, `entity`, `changes` JSON diff |
| `activity_logs` | Usage feed (views, searches, exports) | prunable |
| `saved_searches` | Named queries | `filters` JSON |

## Schema conventions

- **snake_case** columns via `@map`, PascalCase models.
- **cuid()** primary keys.
- **Soft delete** — `deleted_at` on every business entity. Nothing is ever hard-deleted.
- **Explicit `onDelete`** on every FK: `Cascade` for owned children, `Restrict` for master data
  in use, `SetNull` for actor references so deleting a user never destroys an audit entry.
- **Indexes** on every column used for filtering, sorting or joining, plus composites where
  queries pair them (`equipment_id, available`).
- **`@@unique([casNumber, deletedAt])`** — one active product per CAS number, while still
  allowing soft-deleted rows to keep the same CAS.
- **`@@unique([productId, companyId])`** — a company can't be linked to the same product twice.
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

### Determinism

A seeded `mulberry32` PRNG and fixed base dates — no `Date.now()`, no `Math.random()`. The
in-memory adapter and `prisma/seed.ts` produce identical content, so screenshots, tests and the
database always agree.

Dates are anchored to `SEED_NOW` (2026-07-01):
- `products.created_at` spreads across the 24 months ending June 2026.
- `companies.created_at` (ASTRA onboarding, distinct from `established`) spreads the same way.
- This is what gives the rolling-12-month trend chart real shape instead of a flat zero line.
