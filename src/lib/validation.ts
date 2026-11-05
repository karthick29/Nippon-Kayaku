import { z } from 'zod';
import { PRODUCT_STATUSES, STRUCTURE_SEARCH_MODES } from './types';
import type { EquipmentKey, ProductQuery, CompanyQuery, StructureQuery, StructureSearchMode } from './types';

/* ════════════════════════════════════════════════════════════════════
   Zod schemas — the single validation source for React Hook Form on the
   client and every API route on the server. Parsing untrusted input
   through these schemas is what keeps injection and type-confusion out
   of the repository layer.
   ════════════════════════════════════════════════════════════════════ */

/** CAS Registry Number: 2–7 digits, 2 digits, 1 check digit. */
export const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/;

/**
 * Validates the CAS check digit — the last digit equals
 * (Σ position × digit) mod 10, reading right to left from the check digit.
 */
export function isValidCasChecksum(cas: string): boolean {
  if (!CAS_PATTERN.test(cas)) return false;
  const digits = cas.replace(/-/g, '');
  const check = Number(digits.at(-1));
  const body = digits.slice(0, -1).split('').reverse();
  const sum = body.reduce((acc, d, i) => acc + Number(d) * (i + 1), 0);
  return sum % 10 === check;
}

export const casSchema = z
  .string()
  .trim()
  .min(1, 'CAS number is required')
  .regex(CAS_PATTERN, 'Use the CAS format 000000-00-0')
  .refine(isValidCasChecksum, 'CAS check digit does not validate');

/** Hard cap on SMILES / SMARTS input — bounds parse and match cost on the server. */
export const MAX_STRUCTURE_LENGTH = 1000;

/**
 * SMILES — shape check only. Real parsing needs RDKit, which runs on the
 * server: the API canonicalises the structure and returns a 422 on the
 * `smiles` field if it doesn't parse. Empty string clears the structure.
 * An optional CXSMILES extension (` |…|`) is the only whitespace allowed.
 */
export const smilesSchema = z
  .string()
  .trim()
  .max(MAX_STRUCTURE_LENGTH, `SMILES must be ${MAX_STRUCTURE_LENGTH} characters or fewer`)
  .regex(/^(\S+( \|[^|]*\|)?)?$/, 'A SMILES string has no spaces')
  .optional()
  .or(z.literal(''));

export const productStatusSchema = z.enum(
  PRODUCT_STATUSES as [(typeof PRODUCT_STATUSES)[number], ...(typeof PRODUCT_STATUSES)[number][]],
);

/* ── Add Product wizard ─────────────────────────────────────────── */

export const productBasicsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Product name must be at least 2 characters')
    .max(180, 'Product name must be 180 characters or fewer'),
  casNumber: casSchema,
  smiles: smilesSchema,
  molecularFormula: z
    .string()
    .trim()
    .max(60)
    .regex(/^[A-Za-z0-9()·.·\s]*$/, 'Use element symbols and digits only')
    .optional()
    .or(z.literal('')),
  molecularWeight: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    })
    .refine((v) => v === undefined || (v > 0 && v < 100_000), 'Enter a molecular weight between 0 and 100000'),
  applicationId: z.string().min(1, 'Select an application'),
  categoryId: z.string().min(1, 'Select a category'),
  status: productStatusSchema,
  description: z.string().trim().max(2000, 'Description must be 2000 characters or fewer').optional().or(z.literal('')),
  synonyms: z.array(z.string().trim().min(1)).max(12, 'Up to 12 synonyms').optional(),
});

export const productCompanyLinkSchema = z.object({
  companyId: z.string().min(1),
  productCodes: z.array(z.string().trim().min(1)).min(1, 'At least one product code'),
  strength: z.string().trim().max(120).optional().or(z.literal('')),
  presentation: z.string().trim().max(160).optional().or(z.literal('')),
  remarks: z.string().trim().max(400).optional().or(z.literal('')),
});

export const productCreateSchema = productBasicsSchema.extend({
  companies: z.array(productCompanyLinkSchema).max(40).optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export type ProductBasicsValues = z.input<typeof productBasicsSchema>;
export type ProductCreateValues = z.infer<typeof productCreateSchema>;

/* ── Company ────────────────────────────────────────────────────── */

const CURRENT_YEAR = 2026;

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Company name is required').max(160),
  locationId: z.string().min(1, 'Select a location'),
  chemicalStaff: z.coerce.number().int().min(0, 'Cannot be negative').max(100_000),
  phdCount: z.coerce.number().int().min(0, 'Cannot be negative').max(10_000),
  established: z.coerce
    .number()
    .int()
    .min(1800, 'Enter a year after 1800')
    .max(CURRENT_YEAR, `Enter a year up to ${CURRENT_YEAR}`),
  capital: z.string().trim().max(60).optional().or(z.literal('')),
  strength: z.string().trim().max(240).optional().or(z.literal('')),
  presentation: z.string().trim().max(240).optional().or(z.literal('')),
  remarks: z.string().trim().max(1000).optional().or(z.literal('')),
  website: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
  contactEmail: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
});

export type CompanyValues = z.infer<typeof companySchema>;

/* ── Auth ───────────────────────────────────────────────────────── */

export const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

/* ── Bulk operations ────────────────────────────────────────────── */

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Select at least one row').max(500),
});

export const bulkEditSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  patch: z
    .object({
      status: productStatusSchema.optional(),
      applicationId: z.string().min(1).optional(),
      categoryId: z.string().min(1).optional(),
    })
    .refine((p) => Object.values(p).some(Boolean), 'Choose at least one field to change'),
});

/* ── Query-string parsing ───────────────────────────────────────── */

function multi(params: URLSearchParams, key: string): string[] | undefined {
  const values = params.getAll(key).flatMap((v) => v.split(',')).filter(Boolean);
  return values.length ? values : undefined;
}

function int(params: URLSearchParams, key: string, fallback?: number): number | undefined {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Parses a product list/search query string into a typed, bounded query. */
export function parseProductQuery(params: URLSearchParams): ProductQuery {
  const status = multi(params, 'status')?.filter((s): s is (typeof PRODUCT_STATUSES)[number] =>
    (PRODUCT_STATUSES as string[]).includes(s),
  );

  // "relevance" is the absence of a sort — the repository falls back to
  // its match-score ordering when no sort key is supplied.
  const rawSort = params.get('sort');
  const sort = !rawSort || rawSort === 'relevance' ? undefined : rawSort;

  return {
    q: params.get('q')?.slice(0, 200) ?? undefined,
    status,
    applicationId: multi(params, 'application'),
    categoryId: multi(params, 'category'),
    companyId: multi(params, 'company'),
    locationId: multi(params, 'location'),
    equipment: multi(params, 'equipment') as EquipmentKey[] | undefined,
    sort,
    dir: params.get('dir') === 'desc' ? 'desc' : params.get('dir') === 'asc' ? 'asc' : undefined,
    page: int(params, 'page', 1),
    pageSize: Math.min(200, int(params, 'pageSize', 25) ?? 25),
  };
}

/* ── Structure search ───────────────────────────────────────────── */

export const structureQuerySchema = z.object({
  mode: z.enum(STRUCTURE_SEARCH_MODES as [StructureSearchMode, ...StructureSearchMode[]]),
  query: z
    .string()
    .trim()
    .min(1, 'Enter a structure to search for')
    .max(MAX_STRUCTURE_LENGTH, `Structure queries must be ${MAX_STRUCTURE_LENGTH} characters or fewer`),
  threshold: z.coerce.number().min(0.1).max(1).default(0.5),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

/**
 * Reads a structure search from a query string: `mode` + `q` (+ `threshold`),
 * plus the same facet filters as text search. Returns null for a text
 * search or an empty query — callers fall back to `parseProductQuery`.
 * Throws ZodError for a malformed structure query (→ 422).
 */
export function parseStructureQuery(params: URLSearchParams): StructureQuery | null {
  const mode = params.get('mode');
  const q = params.get('q')?.trim();
  if (!mode || mode === 'text' || !q) return null;

  const parsed = structureQuerySchema.parse({
    mode,
    query: q,
    threshold: params.get('threshold') ?? undefined,
    limit: params.get('limit') ?? undefined,
  });
  const { status, applicationId, categoryId, companyId, locationId, equipment } = parseProductQuery(params);
  return { ...parsed, filters: { status, applicationId, categoryId, companyId, locationId, equipment } };
}

/** Parses a company list query string into a typed, bounded query. */
export function parseCompanyQuery(params: URLSearchParams): CompanyQuery {
  return {
    q: params.get('q')?.slice(0, 200) ?? undefined,
    locationId: multi(params, 'location'),
    equipment: multi(params, 'equipment') as EquipmentKey[] | undefined,
    minStaff: int(params, 'minStaff'),
    sort: params.get('sort') ?? undefined,
    dir: params.get('dir') === 'desc' ? 'desc' : params.get('dir') === 'asc' ? 'asc' : undefined,
    page: int(params, 'page', 1),
    pageSize: Math.min(200, int(params, 'pageSize', 25) ?? 25),
  };
}
