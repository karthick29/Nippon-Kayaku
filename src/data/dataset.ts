import type {
  AuditLog,
  Company,
  CompanyEquipment,
  DocumentRecord,
  Product,
  ProductCompany,
  SynthesisRoute,
  User,
} from '@/lib/types';
import { APPLICATION_BY_ID, CATEGORY_BY_ID, LOCATION_BY_ID } from './masters';
import { buildCompanies } from './companies';
import { buildProducts } from './products';
import { buildRoutes } from './routes';

/* ════════════════════════════════════════════════════════════════════
   Dataset assembly.

   Everything below is deterministic — a seeded PRNG, fixed base dates,
   no Date.now(). The same dataset is produced on every server start and
   by prisma/seed.ts, so screenshots, tests and the database agree.
   ════════════════════════════════════════════════════════════════════ */

/** mulberry32 — small, fast, deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reference "now" for the seeded corpus. Keeps relative dates stable. */
export const SEED_NOW = new Date('2026-07-01T00:00:00.000Z');

const applicationName = (id: string) => APPLICATION_BY_ID.get(id)?.name ?? 'Unknown';
const categoryName = (id: string) => CATEGORY_BY_ID.get(id)?.name ?? 'Unknown';
const locationName = (id: string) => LOCATION_BY_ID.get(id)?.name ?? 'Unknown';

export const USERS: User[] = [
  {
    id: 'usr-001',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@nipponkayaku.example.com',
    role: 'ADMIN',
    title: 'Head of Business Development',
    active: true,
    lastActiveAt: '2026-06-30T14:12:00.000Z',
    createdAt: '2023-01-09T06:00:00.000Z',
  },
  {
    id: 'usr-002',
    name: 'Rahul Menon',
    email: 'rahul.menon@nipponkayaku.example.com',
    role: 'MANAGER',
    title: 'Sourcing Manager — Pharma',
    active: true,
    lastActiveAt: '2026-06-29T09:40:00.000Z',
    createdAt: '2023-02-14T06:00:00.000Z',
  },
  {
    id: 'usr-003',
    name: 'Priya Sharma',
    email: 'priya.sharma@nipponkayaku.example.com',
    role: 'ANALYST',
    title: 'Technical Analyst',
    active: true,
    lastActiveAt: '2026-06-30T11:05:00.000Z',
    createdAt: '2023-05-02T06:00:00.000Z',
  },
  {
    id: 'usr-004',
    name: 'Kenji Tanaka',
    email: 'kenji.tanaka@nipponkayaku.example.com',
    role: 'MANAGER',
    title: 'Global Category Lead',
    active: true,
    lastActiveAt: '2026-06-27T16:30:00.000Z',
    createdAt: '2023-03-20T06:00:00.000Z',
  },
  {
    id: 'usr-005',
    name: 'Divya Krishnan',
    email: 'divya.krishnan@nipponkayaku.example.com',
    role: 'ANALYST',
    title: 'Market Intelligence',
    active: true,
    lastActiveAt: '2026-06-24T08:15:00.000Z',
    createdAt: '2024-01-11T06:00:00.000Z',
  },
  {
    id: 'usr-006',
    name: 'Arjun Nair',
    email: 'arjun.nair@nipponkayaku.example.com',
    role: 'VIEWER',
    title: 'Commercial Associate',
    active: true,
    lastActiveAt: '2026-06-18T13:22:00.000Z',
    createdAt: '2024-08-05T06:00:00.000Z',
  },
  {
    id: 'usr-007',
    name: 'Meera Raghavan',
    email: 'meera.raghavan@nipponkayaku.example.com',
    role: 'VIEWER',
    title: 'Regulatory Affairs',
    active: false,
    lastActiveAt: '2025-11-30T10:00:00.000Z',
    createdAt: '2024-09-16T06:00:00.000Z',
  },
];

/* ── Product ⇄ Company links ────────────────────────────────────── */

/**
 * The brief's worked example: Benzyl chloroformate (prd-001) is offered
 * by the four named companies, carrying product codes PR-001 … PR-005.
 */
const EXPLICIT_LINKS: Array<Omit<ProductCompany, 'id' | 'createdAt'>> = [
  {
    productId: 'prd-001',
    companyId: 'cmp-001', // Arkgen
    productCodes: ['PR-001'],
    strength: '50% in toluene',
    presentation: 'OK',
    capital: '$1M',
    remarks: 'Route validated at 100 g; kilo lab slot available from Q3.',
    status: 'Commercial',
  },
  {
    productId: 'prd-001',
    companyId: 'cmp-002', // DSK InnoSciences
    productCodes: ['PR-002'],
    strength: '50% in toluene',
    presentation: '100 mL, 250 mL, 500 mL',
    capital: '$6M',
    remarks: 'In-house NMR release testing; polymer-grade purity available.',
    status: 'Commercial',
  },
  {
    productId: 'prd-001',
    companyId: 'cmp-003', // Sravathi
    productCodes: ['PR-003', 'PR-004'],
    strength: '50% in toluene',
    presentation: 'Continuous output, campaign based',
    capital: '$4M',
    remarks: 'Continuous-flow phosgenation avoids bulk chloroformate hold-up.',
    status: 'Commercial',
  },
  {
    productId: 'prd-001',
    companyId: 'cmp-004', // Gomti
    productCodes: ['PR-005'],
    strength: '50% in toluene',
    presentation: 'Drums, 25–200 kg',
    capital: '$2M',
    remarks: 'Pilot plant campaign capable; halogenated waste incinerated on site.',
    status: 'Commercial',
  },
];

const PRESENTATIONS = [
  '25 kg fibre drum',
  '200 kg HDPE drum',
  '5 kg amber glass',
  '1 MT jumbo bag',
  '50 kg bag',
  '20 L can',
  '1000 L IBC',
  '100 g – 5 kg vials',
];

const LINK_REMARKS = [
  'Qualified supplier; two successful audits on record.',
  'Sample submitted, awaiting analytical sign-off.',
  'Preferred source for regulated-market filings.',
  'Cost leader at this volume band.',
  'Backup source — capacity confirmed, price indicative.',
  'Campaign-based supply, 12-week lead time.',
  'Under commercial negotiation for FY27 volumes.',
  'Long-standing supply relationship, no open CAPAs.',
];

function buildLinks(products: Product[], companies: Company[]): ProductCompany[] {
  const links: ProductCompany[] = [];
  const rand = rng(20260701);
  let counter = 0;

  const push = (link: Omit<ProductCompany, 'id' | 'createdAt'>, createdAt: string) => {
    counter += 1;
    links.push({ ...link, id: `lnk-${String(counter).padStart(4, '0')}`, createdAt });
  };

  EXPLICIT_LINKS.forEach((l, i) => {
    push(l, new Date(Date.UTC(2024, 2, 4 + i * 9, 11, 0)).toISOString());
  });

  // Every other product gets 1–6 suppliers, weighted so commercial
  // products have more sources than development ones.
  products.slice(1).forEach((product, pIndex) => {
    const base = product.status === 'Commercial' ? 2 : product.status === 'Pilot' ? 1 : 1;
    const spread = product.status === 'Commercial' ? 5 : 2;
    const count = base + Math.floor(rand() * spread);

    // Rotating offset gives a deterministic but uneven company spread.
    const offset = (pIndex * 7 + Math.floor(rand() * 5)) % companies.length;
    const picked = new Set<string>();

    for (let i = 0; i < count; i += 1) {
      const company = companies[(offset + i * 3) % companies.length]!;
      if (picked.has(company.id)) continue;
      picked.add(company.id);

      const codeNo = 100 + pIndex * 4 + i;
      const created = new Date(
        Date.UTC(2024, (pIndex + i) % 12, ((pIndex * 5 + i * 3) % 27) + 1, 12, 0),
      );

      push(
        {
          productId: product.id,
          companyId: company.id,
          productCodes: [`PR-${String(codeNo).padStart(3, '0')}`],
          strength: product.name.includes('%')
            ? product.name.slice(product.name.indexOf('(') + 1, -1)
            : `${90 + Math.floor(rand() * 10)}% min`,
          presentation: PRESENTATIONS[Math.floor(rand() * PRESENTATIONS.length)]!,
          capital: company.capital,
          remarks: LINK_REMARKS[Math.floor(rand() * LINK_REMARKS.length)]!,
          status: product.status,
        },
        created.toISOString(),
      );
    }
  });

  return links;
}

/* ── Audit / activity log ───────────────────────────────────────── */

function buildAuditLogs(products: Product[], companies: Company[]): AuditLog[] {
  const logs: AuditLog[] = [];
  const rand = rng(77104);
  const actors = USERS.filter((u) => u.active);

  const templates: Array<{ action: AuditLog['action']; entity: AuditLog['entity']; verb: string }> = [
    { action: 'CREATE', entity: 'product', verb: 'added product' },
    { action: 'UPDATE', entity: 'product', verb: 'updated product' },
    { action: 'UPDATE', entity: 'company', verb: 'updated company profile for' },
    { action: 'CREATE', entity: 'company', verb: 'added company' },
    { action: 'EXPORT', entity: 'report', verb: 'exported' },
    { action: 'UPDATE', entity: 'product', verb: 'changed status of' },
  ];

  for (let i = 0; i < 40; i += 1) {
    const t = templates[Math.floor(rand() * templates.length)]!;
    const actor = actors[Math.floor(rand() * actors.length)]!;
    const isProduct = t.entity === 'product';
    const target = isProduct
      ? products[Math.floor(rand() * products.length)]!
      : companies[Math.floor(rand() * companies.length)]!;

    const label = t.entity === 'report' ? 'Commercial Products Report' : target.name;
    const createdAt = new Date(SEED_NOW.getTime() - (i * 9 + Math.floor(rand() * 8)) * 3_600_000);

    logs.push({
      id: `aud-${String(i + 1).padStart(4, '0')}`,
      action: t.action,
      entity: t.entity,
      entityId: t.entity === 'report' ? 'rpt-commercial' : target.id,
      entityLabel: label,
      actorId: actor.id,
      actorName: actor.name,
      summary: `${actor.name} ${t.verb} ${label}`,
      changes:
        t.action === 'UPDATE' && isProduct
          ? { status: { from: 'Development', to: (target as Product).status } }
          : undefined,
      createdAt: createdAt.toISOString(),
    });
  }

  return logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ── Documents ──────────────────────────────────────────────────── */

function buildDocuments(products: Product[], companies: Company[]): DocumentRecord[] {
  const docs: DocumentRecord[] = [];
  const rand = rng(4242);
  const kinds: DocumentRecord['kind'][] = ['COA', 'MSDS', 'Spec Sheet', 'Audit Report', 'NDA', 'Process Flow'];

  products.slice(0, 24).forEach((p, i) => {
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k += 1) {
      const kind = kinds[(i + k) % kinds.length]!;
      const uploader = USERS[(i + k) % USERS.length]!;
      docs.push({
        id: `doc-p${String(i + 1).padStart(3, '0')}-${k + 1}`,
        productId: p.id,
        name: `${p.name.split('(')[0]!.trim()} — ${kind}.pdf`,
        kind,
        sizeKb: 120 + Math.floor(rand() * 3200),
        version: 1 + Math.floor(rand() * 3),
        uploadedById: uploader.id,
        uploadedByName: uploader.name,
        createdAt: new Date(SEED_NOW.getTime() - (i * 30 + k * 7) * 86_400_000).toISOString(),
      });
    }
  });

  companies.slice(0, 12).forEach((c, i) => {
    const kind: DocumentRecord['kind'] = i % 2 === 0 ? 'Audit Report' : 'NDA';
    const uploader = USERS[i % USERS.length]!;
    docs.push({
      id: `doc-c${String(i + 1).padStart(3, '0')}`,
      companyId: c.id,
      name: `${c.name} — ${kind} 2026.pdf`,
      kind,
      sizeKb: 400 + Math.floor(rand() * 2400),
      version: 1,
      uploadedById: uploader.id,
      uploadedByName: uploader.name,
      createdAt: new Date(SEED_NOW.getTime() - (i * 45 + 12) * 86_400_000).toISOString(),
    });
  });

  return docs;
}

/* ── Public dataset ─────────────────────────────────────────────── */

export interface Dataset {
  products: Product[];
  companies: Company[];
  equipment: CompanyEquipment[];
  links: ProductCompany[];
  users: User[];
  auditLogs: AuditLog[];
  documents: DocumentRecord[];
  routes: SynthesisRoute[];
}

/** Builds a complete, deterministic dataset. Call once per process. */
export function buildDataset(): Dataset {
  const products = buildProducts(applicationName, categoryName);
  const { companies, equipment } = buildCompanies(locationName);
  const links = buildLinks(products, companies);
  const auditLogs = buildAuditLogs(products, companies);
  const documents = buildDocuments(products, companies);
  const routes = buildRoutes(products, SEED_NOW);

  return { products, companies, equipment, links, users: USERS, auditLogs, documents, routes };
}
