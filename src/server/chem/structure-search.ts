import 'server-only';
import type { MainModule as RDKitModule, Mol } from '@rdkit/rdkit';
import type {
  Paginated,
  ProductQuery,
  ProductRow,
  StructureHit,
  StructureQuery,
  StructureSearchResult,
} from '@/lib/types';
import { MAX_STRUCTURE_LENGTH } from '@/lib/validation';
import { throwFieldError } from '@/server/field-error';
import { loadRDKit } from './rdkit';

/* ════════════════════════════════════════════════════════════════════
   Structure search engine — shared by both repository adapters.

   Candidates come from the adapter's own `listProducts`, so facet
   filters behave exactly as in text search and the SQL-filtered set is
   what gets ranked (the same pattern as text relevance). Matching then
   runs in RDKit on the Node runtime.

   Scale note: this compares every in-scope structure per query —
   milliseconds at catalogue scale. For a large corpus, move substructure
   and similarity into PostgreSQL with the RDKit cartridge (`mol` type,
   `@>` operator, GiST index). See docs/ARCHITECTURE.md.
   ════════════════════════════════════════════════════════════════════ */

const FINGERPRINT = JSON.stringify({ radius: 2, nBits: 2048 });
/** Larger queries are almost certainly a pasted mistake, and cost more to match. */
const MAX_QUERY_ATOMS = 150;
const FINGERPRINT_CACHE_LIMIT = 50_000;

declare global {
  // eslint-disable-next-line no-var
  var __astraFingerprints: Map<string, Uint8Array> | undefined;
}

type ListProducts = (query: ProductQuery) => Promise<Paginated<ProductRow>>;

/** A query problem the user can fix — surfaces as a 422 on `q`. */
function invalidQuery(message: string): never {
  throwFieldError(['q'], message);
}

export async function runStructureSearch(query: StructureQuery, listProducts: ListProducts): Promise<StructureSearchResult> {
  const rdkit = await loadRDKit();
  const text = query.query.trim();
  if (!text || text.length > MAX_STRUCTURE_LENGTH) invalidQuery('Enter a structure to search for');

  const { mol: queryMol, interpretedAs } = parseQuery(rdkit, text, query.mode);
  try {
    const inScope = await allProducts(listProducts, query.filters ?? {});
    const candidates = inScope.filter((p) => p.smiles);

    let hits: StructureHit[];
    if (query.mode === 'exact') hits = exactHits(rdkit, queryMol, candidates);
    else if (query.mode === 'similarity') hits = similarityHits(rdkit, queryMol, candidates, query.threshold ?? 0.5);
    else hits = substructureHits(rdkit, queryMol, candidates);

    hits.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
    const limit = query.limit ?? 60;

    return {
      mode: query.mode,
      interpretedAs,
      canonicalQuery: interpretedAs === 'SMILES' ? queryMol.get_smiles() : undefined,
      hits: hits.slice(0, limit),
      total: hits.length,
      searched: candidates.length,
      withoutStructure: inScope.length - candidates.length,
    };
  } finally {
    queryMol.delete();
  }
}

/**
 * SMILES first, then SMARTS. Order matters: Kekulé benzene `C1=CC=CC=C1`
 * read as SMARTS demands aliphatic double bonds and matches no aromatic
 * ring; read as SMILES it's aromatised and matches as a chemist expects.
 */
function parseQuery(rdkit: RDKitModule, text: string, mode: StructureQuery['mode']): { mol: Mol; interpretedAs: 'SMILES' | 'SMARTS' } {
  const asSmiles = rdkit.get_mol(text);
  if (asSmiles?.is_valid() && asSmiles.get_num_atoms(true) > 0) {
    if (asSmiles.get_num_atoms(true) > MAX_QUERY_ATOMS) {
      asSmiles.delete();
      invalidQuery(`Structure queries are limited to ${MAX_QUERY_ATOMS} heavy atoms`);
    }
    return { mol: asSmiles, interpretedAs: 'SMILES' };
  }
  asSmiles?.delete();

  if (mode !== 'substructure') {
    invalidQuery('Not a valid SMILES string. SMARTS patterns work in substructure search only.');
  }
  const asSmarts = rdkit.get_qmol(text);
  if (!asSmarts) invalidQuery('Not a valid SMILES string or SMARTS pattern');
  if (asSmarts.get_num_atoms() > MAX_QUERY_ATOMS) {
    asSmarts.delete();
    invalidQuery(`Structure queries are limited to ${MAX_QUERY_ATOMS} atoms`);
  }
  return { mol: asSmarts, interpretedAs: 'SMARTS' };
}

/** Pages through listProducts so the adapter's page-size cap can never silently drop candidates. */
async function allProducts(listProducts: ListProducts, filters: NonNullable<StructureQuery['filters']>): Promise<ProductRow[]> {
  const rows: ProductRow[] = [];
  for (let page = 1; ; page += 1) {
    const result = await listProducts({ ...filters, page, pageSize: 200 });
    rows.push(...result.rows);
    if (result.rows.length === 0 || page >= result.pageCount) return rows;
  }
}

/* ── Modes ──────────────────────────────────────────────────────── */

/** Identical InChIKey → exact; same first block (skeleton) → same connectivity, e.g. racemate vs enantiomer. */
function exactHits(rdkit: RDKitModule, queryMol: Mol, candidates: ProductRow[]): StructureHit[] {
  const inchi = queryMol.get_inchi();
  if (!inchi) invalidQuery('Could not compute an InChIKey for this structure');
  const key = rdkit.get_inchikey_for_inchi(inchi);
  const skeleton = key.slice(0, 14);

  return candidates.flatMap((product): StructureHit[] => {
    if (!product.inchiKey) return [];
    if (product.inchiKey === key) return [{ product, score: 1, matchKind: 'exact' }];
    if (product.inchiKey.slice(0, 14) === skeleton) return [{ product, score: 0.9, matchKind: 'connectivity' }];
    return [];
  });
}

function substructureHits(rdkit: RDKitModule, queryMol: Mol, candidates: ProductRow[]): StructureHit[] {
  const queryAtoms = queryMol.get_num_atoms();
  const hits: StructureHit[] = [];

  for (const product of candidates) {
    const target = rdkit.get_mol(product.smiles!);
    if (!target) continue;
    try {
      const matches = parseMatches(target.get_substruct_matches(queryMol));
      if (matches.length === 0) continue;
      // Highlight every occurrence (e.g. all three phenyls of a triarylsulfonium).
      const atoms = [...new Set(matches.flatMap((m) => m.atoms))];
      const bonds = [...new Set(matches.flatMap((m) => m.bonds))];
      // Rank by how much of the product the query explains: benzaldehyde
      // searched as `O=Cc1ccccc1` ranks itself above vanillin.
      const score = Math.min(1, queryAtoms / Math.max(1, target.get_num_atoms(true)));
      hits.push({ product, score, matchKind: 'substructure', highlight: { atoms, bonds } });
    } finally {
      target.delete();
    }
  }
  return hits;
}

function similarityHits(rdkit: RDKitModule, queryMol: Mol, candidates: ProductRow[], threshold: number): StructureHit[] {
  const queryFp = new Uint8Array(queryMol.get_morgan_fp_as_uint8array(FINGERPRINT));
  return candidates.flatMap((product): StructureHit[] => {
    const fp = fingerprint(rdkit, product.smiles!);
    if (!fp) return [];
    const score = tanimoto(queryFp, fp);
    return score >= threshold ? [{ product, score, matchKind: 'similar' }] : [];
  });
}

/* ── Helpers ────────────────────────────────────────────────────── */

function parseMatches(json: string): Array<{ atoms: number[]; bonds: number[] }> {
  const parsed = JSON.parse(json) as unknown;
  return Array.isArray(parsed) ? (parsed as Array<{ atoms: number[]; bonds: number[] }>) : [];
}

/** Morgan fingerprints keyed by canonical SMILES, held on globalThis like the store. */
function fingerprint(rdkit: RDKitModule, smiles: string): Uint8Array | null {
  const cache = (globalThis.__astraFingerprints ??= new Map());
  const cached = cache.get(smiles);
  if (cached) return cached;

  const mol = rdkit.get_mol(smiles);
  if (!mol) return null;
  try {
    // Copy out of the WASM heap — a view onto it can be invalidated by later allocations.
    const fp = new Uint8Array(mol.get_morgan_fp_as_uint8array(FINGERPRINT));
    if (cache.size >= FINGERPRINT_CACHE_LIMIT) cache.clear();
    cache.set(smiles, fp);
    return fp;
  } finally {
    mol.delete();
  }
}

const POPCOUNT = Uint8Array.from({ length: 256 }, (_, byte) => {
  let bits = 0;
  for (let v = byte; v; v >>= 1) bits += v & 1;
  return bits;
});

/** Tanimoto on packed bit vectors: |A∧B| / |A∨B|. */
export function tanimoto(a: Uint8Array, b: Uint8Array): number {
  let both = 0;
  let either = 0;
  for (let i = 0; i < a.length; i += 1) {
    both += POPCOUNT[a[i]! & b[i]!]!;
    either += POPCOUNT[a[i]! | b[i]!]!;
  }
  return either === 0 ? 0 : both / either;
}
