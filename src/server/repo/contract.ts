import type {
  AuditLog,
  Company,
  CompanyEquipment,
  CompanyQuery,
  CompanyRow,
  DashboardMetrics,
  DocumentRecord,
  EquipmentKey,
  Paginated,
  Product,
  ProductCompanyRow,
  ProductQuery,
  ProductRow,
  SearchHit,
  User,
} from '@/lib/types';

/* ════════════════════════════════════════════════════════════════════
   Repository contract.

   Every read and write in ASTRA goes through this interface. Two
   adapters implement it — `memory` (default, zero setup) and `prisma`
   (PostgreSQL). Nothing above this layer knows which is active.
   ════════════════════════════════════════════════════════════════════ */

export interface ProductInput {
  name: string;
  casNumber: string;
  /**
   * Canonical SMILES and its InChIKey — set by the API layer via
   * `resolveStructureInput()`, never straight from user input. Empty
   * string clears the structure; undefined leaves it unchanged.
   */
  smiles?: string;
  inchiKey?: string;
  molecularFormula?: string;
  molecularWeight?: number;
  applicationId: string;
  categoryId: string;
  status: Product['status'];
  description?: string;
  synonyms?: string[];
  /** Company links created alongside the product (wizard step 2). */
  companies?: Array<{
    companyId: string;
    productCodes: string[];
    strength?: string;
    presentation?: string;
    remarks?: string;
  }>;
}

export interface CompanyInput {
  name: string;
  locationId: string;
  chemicalStaff: number;
  phdCount: number;
  established: number;
  capital?: string;
  strength?: string;
  presentation?: string;
  remarks?: string;
  website?: string;
  contactEmail?: string;
}

export interface Actor {
  id: string;
  name: string;
}

export interface Repository {
  /* Products */
  listProducts(query: ProductQuery): Promise<Paginated<ProductRow>>;
  getProduct(idOrSlug: string): Promise<ProductRow | null>;
  getProductCompanies(productId: string): Promise<ProductCompanyRow[]>;
  createProduct(input: ProductInput, actor: Actor): Promise<ProductRow>;
  updateProduct(id: string, input: Partial<ProductInput>, actor: Actor): Promise<ProductRow | null>;
  deleteProducts(ids: string[], actor: Actor): Promise<number>;
  duplicateProduct(id: string, actor: Actor): Promise<ProductRow | null>;

  /* Companies */
  listCompanies(query: CompanyQuery): Promise<Paginated<CompanyRow>>;
  getCompany(idOrSlug: string): Promise<CompanyRow | null>;
  getCompanyEquipment(companyId: string): Promise<CompanyEquipment[]>;
  getCompanyProducts(companyId: string): Promise<ProductRow[]>;
  createCompany(input: CompanyInput, actor: Actor): Promise<CompanyRow>;
  updateCompany(id: string, input: Partial<CompanyInput>, actor: Actor): Promise<CompanyRow | null>;
  deleteCompanies(ids: string[], actor: Actor): Promise<number>;

  /* Search */
  search(q: string, opts?: { limit?: number; types?: SearchHit['type'][] }): Promise<SearchHit[]>;

  /* Analytics */
  dashboard(): Promise<DashboardMetrics>;
  equipmentCoverage(): Promise<Array<{ key: EquipmentKey; name: string; companies: number; pct: number }>>;

  /* Supporting entities */
  listAuditLogs(limit?: number): Promise<AuditLog[]>;
  listEntityAuditLogs(entityId: string, limit?: number): Promise<AuditLog[]>;
  listDocuments(scope: { productId?: string; companyId?: string }): Promise<DocumentRecord[]>;
  listUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | null>;
  recordAudit(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog>;

  /** Raw access for report generation. */
  allCompanies(): Promise<Company[]>;
  allProducts(): Promise<Product[]>;
}
