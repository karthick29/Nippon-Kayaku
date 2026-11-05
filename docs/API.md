# REST API

All routes live under `/api`, run on the Node runtime, and are `force-dynamic`.

## Envelope

Success:
```json
{ "data": <payload> }
```

Failure:
```json
{ "error": { "message": "Validation failed", "fields": { "casNumber": "CAS check digit does not validate" } } }
```

| Status | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 401 | No valid session |
| 403 | Session lacks the required permission |
| 404 | Not found |
| 422 | Zod validation failed — `fields` maps field paths to messages |
| 500 | Unexpected error; details logged server-side, never returned |

The `fields` map is keyed by form field path so a client can call
`form.setError(field, { message })` directly — the wizard and edit form both do. Nested paths are
dotted: a bad SMILES on a route's third input is `inputs.2.externalSmiles`.

Some 422s can only be decided on the server — an unparseable structure, a synthesis route that
would form a loop. They use the same envelope, so a form handles them exactly like schema errors.

## Authentication

Every route calls `requirePermission(...)`, which verifies the `astra.session` JWT and checks
the role. Middleware performs a cheap cookie-presence check first and returns 401 for `/api/*`
without one.

---

## Products

### `GET /api/products`
Permission: `product:read`

| Query param | Type | Notes |
|---|---|---|
| `q` | string | Fuzzy across name, CAS, synonyms, formula, application, companies, description |
| `status` | csv | `Commercial,Development,Pilot,Discontinued` |
| `application` | csv | Application IDs |
| `category` | csv | Category IDs |
| `company` | csv | Company IDs |
| `location` | csv | Location IDs |
| `equipment` | csv | Capability keys — matches products with a supplier that has **all** of them |
| `sort` | string | `name` · `casNumber` · `status` · `companyCount` · `createdAt`; `relevance` means no sort |
| `dir` | string | `asc` \| `desc` |
| `page`, `pageSize` | int | `pageSize` capped at 200 |

```json
{ "data": { "rows": [ … ], "total": 50, "page": 1, "pageSize": 25, "pageCount": 2 } }
```

A `ProductRow` is a product plus `companyCount` and a `companies[]` summary.

### `POST /api/products`
Permission: `product:create` · Body validated by `productCreateSchema`

```json
{
  "name": "Benzyl chloroformate (50% in toluene)",
  "casNumber": "501-53-1",
  "smiles": "ClC(=O)OCc1ccccc1",
  "molecularFormula": "C8H7ClO2",
  "molecularWeight": 170.59,
  "applicationId": "app-pharma-agro",
  "categoryId": "cat-formulation",
  "status": "Commercial",
  "description": "Cbz protecting-group reagent…",
  "synonyms": ["Cbz-Cl", "Z-Cl"],
  "companies": [
    { "companyId": "cmp-001", "productCodes": ["PR-001"], "strength": "50% in toluene" }
  ]
}
```

`casNumber` must match `^\d{2,7}-\d{2}-\d# REST API

All routes live under `/api`, run on the Node runtime, and are `force-dynamic`.

## Envelope

Success:
```json
{ "data": <payload> }
```

Failure:
```json
{ "error": { "message": "Validation failed", "fields": { "casNumber": "CAS check digit does not validate" } } }
```

| Status | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 401 | No valid session |
| 403 | Session lacks the required permission |
| 404 | Not found |
| 422 | Zod validation failed — `fields` maps field paths to messages |
| 500 | Unexpected error; details logged server-side, never returned |

The `fields` map is keyed by form field path so a client can call
`form.setError(field, { message })` directly — the wizard and edit form both do. Nested paths are
dotted: a bad SMILES on a route's third input is `inputs.2.externalSmiles`.

Some 422s can only be decided on the server — an unparseable structure, a synthesis route that
would form a loop. They use the same envelope, so a form handles them exactly like schema errors.

## Authentication

Every route calls `requirePermission(...)`, which verifies the `astra.session` JWT and checks
the role. Middleware performs a cheap cookie-presence check first and returns 401 for `/api/*`
without one.

---

## Products

### `GET /api/products`
Permission: `product:read`

| Query param | Type | Notes |
|---|---|---|
| `q` | string | Fuzzy across name, CAS, synonyms, formula, application, companies, description |
| `status` | csv | `Commercial,Development,Pilot,Discontinued` |
| `application` | csv | Application IDs |
| `category` | csv | Category IDs |
| `company` | csv | Company IDs |
| `location` | csv | Location IDs |
| `equipment` | csv | Capability keys — matches products with a supplier that has **all** of them |
| `sort` | string | `name` · `casNumber` · `status` · `companyCount` · `createdAt`; `relevance` means no sort |
| `dir` | string | `asc` \| `desc` |
| `page`, `pageSize` | int | `pageSize` capped at 200 |

```json
{ "data": { "rows": [ … ], "total": 50, "page": 1, "pageSize": 25, "pageCount": 2 } }
```

A `ProductRow` is a product plus `companyCount` and a `companies[]` summary.

### `POST /api/products`
Permission: `product:create` · Body validated by `productCreateSchema`

```json
{
  "name": "Benzyl chloroformate (50% in toluene)",
  "casNumber": "501-53-1",
  "smiles": "ClC(=O)OCc1ccccc1",
  "molecularFormula": "C8H7ClO2",
  "molecularWeight": 170.59,
  "applicationId": "app-pharma-agro",
  "categoryId": "cat-formulation",
  "status": "Commercial",
  "description": "Cbz protecting-group reagent…",
  "synonyms": ["Cbz-Cl", "Z-Cl"],
  "companies": [
    { "companyId": "cmp-001", "productCodes": ["PR-001"], "strength": "50% in toluene" }
  ]
}
```

 **and** pass the CAS check-digit calculation.
Returns `201` with the created `ProductRow`.

`smiles` is optional. The server parses it with RDKit and stores the **canonical** form plus its
`inchiKey` — the example above is stored as `O=C(Cl)OCc1ccccc1`. Unparseable input is a 422 on
`smiles`. On `PATCH`, omit `smiles` to leave the structure alone; send `""` to clear it.

### `GET /api/products/:idOrSlug` · `product:read`
### `PATCH /api/products/:id` · `product:update`
Partial body. Changed fields are recorded as a diff in the audit log.
### `DELETE /api/products/:id` · `product:delete`
Soft delete. Returns `{ "data": { "deleted": 1 } }`.

### `POST /api/products/:id/duplicate` · `product:create`
Copies the product and all its company links; the copy is named `… (copy)` and set to
`Development`. Returns `201`.

### `GET /api/products/:idOrSlug/companies` · `product:read`
The full capability matrix — one row per supplying company with an `equipment` map keyed by
capability, plus product codes, strength, presentation, capital and supply status.

### `POST /api/products/bulk` · `product:update`
```json
{ "ids": ["prd-001","prd-002"], "patch": { "status": "Commercial" } }
```
`patch` accepts `status`, `applicationId`, `categoryId`; at least one is required.
Returns `{ "data": { "updated": 2 } }`.

### `DELETE /api/products/bulk` · `product:delete`
```json
{ "ids": ["prd-001","prd-002"] }
```
Max 500 ids. Returns `{ "data": { "deleted": 2 } }`.

---

## Companies

### `GET /api/companies` · `company:read`
Params: `q`, `location` (csv), `equipment` (csv), `minStaff`, `sort`, `dir`, `page`, `pageSize`.
Rows carry `productCount` and `equipmentCount`.

### `POST /api/companies` · `company:create`
Body validated by `companySchema`. Creating a company also seeds an empty `company_equipment`
row per capability type, so the Equipment tab is a complete editable matrix from day one.

### `GET /api/companies/:idOrSlug` · `company:read`
```json
{ "data": { "company": { … }, "equipment": [ … ], "products": [ … ] } }
```

### `PATCH /api/companies/:id` · `company:update`
### `DELETE /api/companies/:id` · `company:delete` — soft delete

---

## Search

### `GET /api/search` · `product:read`

| Param | Notes |
|---|---|
| `q` | Max 200 chars |
| `limit` | Default 20, max 50 |
| `types` | csv of `product,company,application,location` |

```json
{
  "data": [
    {
      "type": "product",
      "id": "prd-001",
      "slug": "benzyl-chloroformate-50-in-toluene",
      "title": "Benzyl chloroformate (50% in toluene)",
      "subtitle": "501-53-1 · Pharma and Agro Intermediate",
      "matchedField": "CAS number",
      "matchedValue": "501-53-1",
      "score": 1100,
      "href": "/products/benzyl-chloroformate-50-in-toluene"
    }
  ]
}
```

`matchedField` powers the "matched CAS number" hint in the palette. CAS matching ignores
separators, so `501531` finds `501-53-1`.

---

## Structures

Chemistry runs on the server (RDKit, WASM). Structure inputs are capped at 1000 characters.

### `GET /api/structure/depict` · `product:read`

| Param | Notes |
|---|---|
| `smiles` | Required |
| `w`, `h` | Drawing size in px, 80–600; default 240 × 180 |

```json
{
  "data": {
    "canonicalSmiles": "O=C(Cl)OCc1ccccc1",
    "inchiKey": "HSDAJNMJOMSNEV-UHFFFAOYSA-N",
    "formula": "C8H7ClO2",
    "molecularWeight": 170.6,
    "svg": "<svg …>"
  }
}
```

Backs the live preview in the product forms. The SVG is drawn in `currentColor` so it themes
when inserted inline; it never echoes input text and script-capable output is refused.
422 on `smiles` if it doesn't parse.

### `GET /api/structure/search` · `product:read`

| Param | Notes |
|---|---|
| `mode` | `substructure` · `similarity` · `exact` |
| `q` | SMILES (all modes) or SMARTS (substructure only) |
| `threshold` | Similarity only; minimum Tanimoto 0.1–1, default 0.5 |
| `limit` | 1–200, default 60 |
| `status`, `application`, `category`, `company`, `location`, `equipment` | Same facets as `GET /api/products`, applied before matching |

```json
{
  "data": {
    "mode": "substructure",
    "interpretedAs": "SMILES",
    "canonicalQuery": "C1CO1",
    "hits": [
      {
        "product": { … },
        "score": 0.6,
        "matchKind": "substructure",
        "highlight": { "atoms": [2, 3, 4], "bonds": [2, 3, 4] }
      }
    ],
    "total": 2,
    "searched": 49,
    "withoutStructure": 1
  }
}
```

| Mode | `score` | `matchKind` |
|---|---|---|
| `substructure` | Share of the product's heavy atoms the query covers | `substructure`, with every match in `highlight` |
| `similarity` | Tanimoto on Morgan fingerprints (radius 2, 2048 bits) | `similar` |
| `exact` | 1 for an identical InChIKey; 0.9 for the same skeleton (first InChIKey block) | `exact` · `connectivity` |

The query is read as SMILES first, then SMARTS — so Kekulé `C1=CC=CC=C1` matches aromatic rings.
A SMILES query doesn't fix hydrogen counts (`O=Cc1ccccc1` also matches aryl ketones); use SMARTS
such as `[CH1](=O)c` to require an aldehyde. `withoutStructure` counts in-scope products that
have no recorded structure and so can't match. 422 on `q` for an unparseable query, SMARTS
outside substructure mode, or more than 150 atoms.

---

## Synthesis

Route reads need `product:read`; route writes need `product:update` (Analyst and above). Every
write is recorded in the product's audit trail, with a field diff on update.

### `GET /api/products/:idOrSlug/routes` · `product:read`
Routes that make the product, preferred first. Catalogue inputs carry a `product` summary
including `companyCount` — the supply-risk signal.

### `POST /api/products/:idOrSlug/routes` · `product:update`
Body validated by `routeSchema`:

```json
{
  "name": "Glycidylation of bisphenol A",
  "isPreferred": true,
  "reviewStatus": "unreviewed",
  "notes": "Bisphenol A with excess epichlorohydrin, then NaOH.",
  "inputs": [
    { "role": "building-block", "externalName": "Bisphenol A", "externalCas": "80-05-7", "externalSmiles": "CC(C)(c1ccc(O)cc1)c1ccc(O)cc1" },
    { "role": "reagent", "productId": "prd-031", "quantity": "2.1 eq" }
  ]
}
```

- `role`: `building-block` · `reagent` · `catalyst` · `solvent`.
- Each input is **either** `productId` (a catalogue product) **or** `externalName` (+ optional
  `externalCas`, checksum-validated, and `externalSmiles`, canonicalised like product SMILES).
- 1–30 inputs; a catalogue product may appear once per route.
- `isPreferred: true` clears the flag on the product's other routes.

Returns `201` with the route. Server-side 422s, each pointed at the offending row:

| Field | Message when |
|---|---|
| `inputs.N.productId` | Not an active catalogue product |
| `inputs.N.productId` | The product is an input to its own route |
| `inputs.N.productId` | That product is already made from this one — the route would create a loop |
| `inputs.N.externalSmiles` | The SMILES doesn't parse |

### `PATCH /api/routes/:routeId` · `product:update`
Same body as create; replaces the route's fields and inputs wholesale.

### `DELETE /api/routes/:routeId` · `product:update`
Soft delete. The route leaves the product, the map and where-used results; deleting it again is a 404.

### `GET /api/products/:idOrSlug/where-used` · `product:read`
Param: `depth`, 1–10, default 6.

```json
{
  "data": [
    {
      "product": { "id": "prd-020", "name": "Chlorpyrifos", "companyCount": 2, … },
      "depth": 1,
      "routeId": "rte-001",
      "routeName": "Phosphorylation of 3,5,6-trichloro-2-pyridinol",
      "role": "building-block",
      "via": []
    }
  ]
}
```

Every product made from this one, each **once, at its shortest chain**; `via` lists the
intermediates in order (empty for a direct input).

---

## Analytics & reference

### `GET /api/dashboard` · `product:read`
Every metric and chart series the dashboard renders: totals, `byApplication`, `byStatus`,
`byCity`, `byCategory`, `topCompanies`, `equipmentAvailability`, `monthlyAdditions`,
`recentProducts`, `recentActivity`.

### `GET /api/masters` · `product:read`
All reference lists: `applications`, `categories`, `locations`, `equipment`, `statuses`.

### `GET /api/audit` · `audit:read`
Params: `limit` (default 100, max 500), `entityId` to scope to one record.

---

## Server Actions

Sign-in and sign-out are Server Actions, not REST routes — the form works without JavaScript and
Next.js applies its built-in Action origin check, which is ASTRA's CSRF protection for mutations.

| Action | Module |
|---|---|
| `signInAction(prevState, formData)` | `src/server/actions/auth.ts` |
| `signOutAction()` | `src/server/actions/auth.ts` |

---

## Adding an endpoint

```ts
import { ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';

export const dynamic = 'force-dynamic';

export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');   // 1. authorize
  const query = parseProductQuery(request.nextUrl.searchParams); // 2. validate
  return ok(await repo.listProducts(query)); // 3. delegate to the repository
});
```

`route()` wraps the handler in the shared error mapping, so Zod errors become 422s with field
messages and unexpected throws become 500s without leaking a stack trace.
