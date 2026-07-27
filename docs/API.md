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
`form.setError(field, { message })` directly — the wizard and edit form both do.

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

`casNumber` must match `^\d{2,7}-\d{2}-\d$` **and** pass the CAS check-digit calculation.
Returns `201` with the created `ProductRow`.

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
