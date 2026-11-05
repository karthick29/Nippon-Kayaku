/* ════════════════════════════════════════════════════════════════════
   ASTRA domain model.

   These types are the contract between the repository layer, the API
   routes and the UI. They mirror prisma/schema.prisma exactly — the
   in-memory adapter and the Prisma adapter both return these shapes, so
   swapping the data source changes nothing above the repository.
   ════════════════════════════════════════════════════════════════════ */

export type ProductStatus = 'Commercial' | 'Development' | 'Pilot' | 'Discontinued';

export const PRODUCT_STATUSES: ProductStatus[] = ['Commercial', 'Development', 'Pilot', 'Discontinued'];

export type Role = 'ADMIN' | 'MANAGER' | 'ANALYST' | 'VIEWER';

export const ROLES: Role[] = ['ADMIN', 'MANAGER', 'ANALYST', 'VIEWER'];

/** Every capability the RBAC layer knows about. */
export type Permission =
  | 'product:read'
  | 'product:create'
  | 'product:update'
  | 'product:delete'
  | 'company:read'
  | 'company:create'
  | 'company:update'
  | 'company:delete'
  | 'report:read'
  | 'report:export'
  | 'settings:read'
  | 'settings:manage'
  | 'audit:read'
  | 'user:manage';

export interface MasterRecord {
  id: string;
  name: string;
  slug: string;
  description?: string;
  /** Display order in pickers. */
  sortOrder: number;
  active: boolean;
}

/** applications master. */
export interface Application extends MasterRecord {
  /** Domain colour key used for badges and charts. */
  colorKey: 'pharma' | 'agro' | 'polymer' | 'specialty' | 'electronic' | 'dye';
}

/** product_categories master. */
export interface ProductCategory extends MasterRecord {}

/** company_locations master. */
export interface Location extends MasterRecord {
  state: string;
  country: string;
  region: string;
}

/** equipment_master — the canonical capability list. */
export interface EquipmentMaster {
  id: string;
  key: EquipmentKey;
  name: string;
  /** Grouping used on the Equipment tab. */
  group: 'Reaction' | 'Isolation' | 'Analytical' | 'Scale-up' | 'Infrastructure';
  /** How the value should be read: a count, a free-text spec, or yes/no. */
  valueType: 'count' | 'spec' | 'boolean';
  unit?: string;
  sortOrder: number;
}

export type EquipmentKey =
  | 'hoods'
  | 'autoclave'
  | 'flowChemistry'
  | 'kiloLab'
  | 'rotavapor'
  | 'openReaction'
  | 'hplc'
  | 'gc'
  | 'ms'
  | 'prepHplc'
  | 'nmr'
  | 'pilotPlant'
  | 'incineration'
  | 'hydrogenation'
  | 'cryoReactor';

/** company_equipment — one row per company per capability. */
export interface CompanyEquipment {
  id: string;
  companyId: string;
  equipmentKey: EquipmentKey;
  available: boolean;
  /** Numeric count where valueType === 'count'. */
  count?: number;
  /** Free-text specification, e.g. "500 mL, 2 L". */
  specification?: string;
  /** Working capacity, e.g. "100 L Glass". */
  capacity?: string;
  remarks?: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  locationId: string;
  /** Denormalised for list rendering; always kept in sync by the repo. */
  locationName: string;
  chemicalStaff: number;
  phdCount: number;
  established: number;
  /** Free-text capital / investment figure, e.g. "$1M". */
  capital?: string;
  /** Headline capability, e.g. "Flow Chemistry". */
  strength?: string;
  /** How material is presented / packed. */
  presentation?: string;
  remarks?: string;
  website?: string;
  contactEmail?: string;
  /** ISO date. */
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  casNumber: string;
  /**
   * RDKit canonical SMILES. For a solution or formulation this is the
   * active substance. Absent (or empty) when no structure is recorded —
   * e.g. organometallic precatalysts that SMILES represents poorly.
   */
  smiles?: string;
  /** Standard InChIKey derived from `smiles` — structure identity. */
  inchiKey?: string;
  molecularFormula?: string;
  molecularWeight?: number;
  applicationId: string;
  applicationName: string;
  categoryId: string;
  categoryName: string;
  status: ProductStatus;
  description?: string;
  /** Synonyms and trade names — searchable. */
  synonyms: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/** product_company join — a product available from a company. */
export interface ProductCompany {
  id: string;
  productId: string;
  companyId: string;
  /** Internal codes, e.g. ["PR-001"]. */
  productCodes: string[];
  strength?: string;
  presentation?: string;
  capital?: string;
  remarks?: string;
  status: ProductStatus;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title?: string;
  active: boolean;
  lastActiveAt?: string;
  createdAt: string;
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'EXPORT' | 'LOGIN';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entity: 'product' | 'company' | 'user' | 'master' | 'report' | 'session';
  entityId: string;
  entityLabel: string;
  actorId: string;
  actorName: string;
  summary: string;
  /** JSON diff of changed fields. */
  changes?: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  productId?: string;
  companyId?: string;
  name: string;
  kind: 'COA' | 'MSDS' | 'Spec Sheet' | 'Audit Report' | 'NDA' | 'Process Flow';
  sizeKb: number;
  version: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

/* ── View models ────────────────────────────────────────────────── */

/** A product joined with its company availability — the list/table row. */
export interface ProductRow extends Product {
  companyCount: number;
  companies: Array<Pick<Company, 'id' | 'name' | 'slug' | 'locationName'>>;
}

/** A company row on a product's Companies tab — the widest table in ASTRA. */
export interface ProductCompanyRow {
  linkId: string;
  company: Company;
  equipment: Record<EquipmentKey, CompanyEquipment | undefined>;
  productCodes: string[];
  strength?: string;
  presentation?: string;
  capital?: string;
  remarks?: string;
  status: ProductStatus;
}

export interface CompanyRow extends Company {
  productCount: number;
  equipmentCount: number;
}

/* ── Query contracts ────────────────────────────────────────────── */

export interface ProductQuery {
  q?: string;
  status?: ProductStatus[];
  applicationId?: string[];
  categoryId?: string[];
  companyId?: string[];
  locationId?: string[];
  equipment?: EquipmentKey[];
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface CompanyQuery {
  q?: string;
  locationId?: string[];
  equipment?: EquipmentKey[];
  minStaff?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** A single hit from the unified search engine. */
export interface SearchHit {
  type: 'product' | 'company' | 'application' | 'location';
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  /** Which field produced the match, for the "matched on" hint. */
  matchedField: string;
  matchedValue: string;
  score: number;
  href: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Partial<ProductQuery>;
  ownerId: string;
  createdAt: string;
}

/* ── Analytics contracts ────────────────────────────────────────── */

export interface CountBucket {
  key: string;
  label: string;
  value: number;
  colorKey?: string;
}

export interface DashboardMetrics {
  totalProducts: number;
  commercialProducts: number;
  developmentProducts: number;
  pilotProducts: number;
  totalCompanies: number;
  totalLocations: number;
  totalApplications: number;
  totalLinks: number;
  avgCompaniesPerProduct: number;
  productsAddedLast30d: number;
  byApplication: CountBucket[];
  byStatus: CountBucket[];
  byCity: CountBucket[];
  byCategory: CountBucket[];
  topCompanies: CountBucket[];
  equipmentAvailability: CountBucket[];
  monthlyAdditions: Array<{ month: string; products: number; companies: number }>;
  recentProducts: ProductRow[];
  recentActivity: AuditLog[];
}
