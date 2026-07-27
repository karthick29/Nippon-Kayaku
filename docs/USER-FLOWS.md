# Information architecture & user flows

## Who uses this

ASTRA is an internal tool for Nippon Kayaku business teams. Three recurring jobs:

1. **"Who can make this molecule?"** — sourcing, starting from a name or CAS number.
2. **"What can this site actually do?"** — technical assessment of a supplier's capability.
3. **"What does our portfolio look like?"** — management reporting.

Every navigation decision below serves one of those three.

---

## Navigation

```
ASTRA
├── Overview
│   ├── Dashboard              KPIs, charts, latest products, activity
│   └── Search Chemicals       The eMolecules-style entry point
├── Catalogue
│   ├── Products               Table · Add · Details (5 tabs) · Edit
│   └── Companies              Table · Profile (5 tabs)
├── Insight
│   ├── Analytics              9 charts across portfolio, footprint, capability
│   └── Reports                6 reports → CSV / Excel / PDF
└── Administration
    └── Settings               Preferences · Users · Roles · Master Data · Audit
```

Sidebar groups are labelled by *intent* ("Overview", "Catalogue", "Insight") rather than by
object type, so someone who knows what they want to do finds it without knowing the data model.

Products and Companies carry live counts in the sidebar — the size of the catalogue is
ambient information, not something you navigate to discover.

---

## Flow 1 · Find a chemical and its suppliers

The primary flow. Three entry points, all converging on the same place.

```
  ⌘K palette ──┐
  Dashboard  ──┼──► /search?q=… ──► Result card ──► /products/[slug] ──► Companies tab
  Sidebar    ──┘                                                              │
                                                                              ▼
                                                                   /companies/[slug]
```

**Command palette (⌘K)** — fastest. Debounced 140 ms, searches products, companies,
applications and locations at once, and tells you *which field matched* ("matched CAS number") so
a hit on a synonym isn't mysterious.

**Search Chemicals** — the considered path. Hero input, then facets for status, application,
category, location and **supplier capability**. That last one is the differentiator: "show me
products where at least one supplier has flow chemistry" is a sourcing question no chemical
catalogue normally answers.

Search state lives entirely in the URL, so a filtered result set is shareable and survives back
navigation. Typing uses `router.replace`, so the history stack holds one entry per search rather
than one per keystroke.

**Result card** shows name, CAS, application, status and the companies that can supply it, with
matched terms highlighted. Grid or list, user's choice, persisted in the URL.

---

## Flow 2 · Assess a supplier

```
  /products/[slug] ?tab=companies          ← the widest table in ASTRA
        │  21 columns: staffing · 11 capabilities · strength · presentation · capital · codes
        ▼
  /companies/[slug]
        ├── Overview       Facts of record, headline strength, capability coverage bar
        ├── Equipment      Cards grouped by Reaction / Isolation / Analytical / Scale-up / Infrastructure
        ├── Products       Everything this site supplies
        ├── Capabilities   Coverage by group + the full matrix, available and not
        └── Analytics      Portfolio by application, status, category; capacity by capability
```

The Companies tab is where a sourcing decision actually gets made, so it carries the full column
set from the brief rather than a summary. Readability at 21 columns comes from:

- **Sticky company column** while scrolling horizontally.
- **Per-column resize** with a live drag handle.
- **Column visibility menu** to hide what a given question doesn't need.
- **Zero renders as a dash**, not `0` — an explicit "none" instead of data-entry noise.
- **Export mirrors the screen** — current filter, current column order.

The Equipment tab deliberately shows unavailable capabilities too, as dashed-border cards. What a
site *can't* do is as decision-relevant as what it can.

---

## Flow 3 · Add a product

```
  Step 1 · Basic Information     name · CAS · formula · MW · status · application · category · synonyms · description
        ▼ (validates before advancing)
  Step 2 · Company Mapping       filter panel → attach companies → per-link codes, strength, presentation, remarks
        ▼
  Step 3 · Review                full summary + the company table as it will be saved
        ▼
  POST /api/products  ──►  /products/[slug]
```

- **Forward moves validate; backward is always free.**
- **CAS numbers are checksum-validated**, not just pattern-matched — `501-53-2` is rejected as a
  typo even though it looks right.
- **The draft autosaves to localStorage** every 600 ms and is restored on return with a toast.
  Losing a half-filled chemical record to an accidental refresh is the single most annoying thing
  this form could do.
- **Server-side field errors map back onto the form** and jump the user to the step that owns
  the bad field.

---

## Flow 4 · Bulk operations

```
  /products ──► select rows ──► bulk bar appears
                                  ├── Bulk edit    → status / application / category
                                  └── Delete       → confirmation dialog → soft delete
```

Import runs the opposite way: CSV → parse → **validate every row** → preview with per-row
pass/fail and reasons → import only the valid rows. An import that half-succeeds silently is
worse than one that refuses to start, so the preview is not skippable.

---

## Flow 5 · Report and export

```
  /reports ──► pick one of 6 ──► preview ──► CSV │ Excel │ PDF
```

Reports: Product · Company · Commercial Products · Development Products · Capability ·
Products Without a Supplier.

The last one is a gap report — catalogue entries with no supplier mapped. It's the report a
sourcing team actually acts on.

Exports run client-side against the rows on screen, so what you exported is what you were looking
at. Excel gets a frozen header row and autofilter; PDF gets a branded header, page numbers and
landscape orientation past six columns.

---

## Flow 6 · Administration

```
  /settings
    ├── Preferences    theme · density · tooltips · destructive-action confirmation · search history
    ├── Users          the directory with roles and activity
    ├── Roles          permission matrix, generated from the enforced map
    ├── Master Data    applications · locations · statuses · categories · equipment, each with usage counts
    └── Audit Logs     append-only trail with field-level diffs   (MANAGER+)
```

Master Data shows a **usage count** per entry, so it's obvious before anyone tries that an
application used by 12 products cannot be deleted.

The Roles matrix is rendered *from* `ROLE_PERMISSIONS` — the same map the API guards use. It
cannot drift from what is actually enforced.

---

## State conventions

| State | Where it lives | Why |
|---|---|---|
| Search query, filters, sort, view | URL | Shareable, bookmarkable, survives back |
| Active tab on detail pages | URL (`?tab=`) | A link to the Companies tab is a useful thing to send someone |
| Table sort, column widths, visibility, selection | Component state | Per-session view preferences, not worth a URL |
| Theme, density | `localStorage` + `data-*` on `<html>` | Applied before first paint; no flash |
| Recent searches | `localStorage` | Half-typed queries are not something the platform needs to store |
| Sidebar collapsed | `localStorage` | Personal, per-device |
| Product draft | `localStorage` | Survives a refresh mid-form |

---

## Every state is designed

| State | Treatment |
|---|---|
| Loading | Skeletons that mirror the loaded layout, per-page Suspense boundaries |
| Empty (no data) | Icon, one-line next step, and an action |
| Empty (filtered out) | Different copy — "clear a filter" rather than "add a product" |
| Error | Error boundary with retry and a support reference |
| 404 | In-shell not-found with search and dashboard links; returns a real 404 status |
| Success | Toast, bottom-right |
| Destructive | Confirmation dialog stating that delete is soft and recoverable |
| No permission | Action hidden in the UI, redirect on the page, 403 from the API |
