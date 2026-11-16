/* ════════════════════════════════════════════════════════════════════
   Reading a drawing — what is on the structure editor's canvas.

   The editor hands back KET, Ketcher's documented JSON interchange format.
   This module inspects it and decides nothing about the UI: it is pure, so
   it runs in the browser and under `npm run check:drawing` alike.

   Why inspect at all: Ketcher's `getSmiles()` does not refuse what SMILES
   cannot express — it writes something else. An atom list `[C,N]` comes
   back as `*`, an "any" bond as a single bond, an R-group as `[*:1]`
   (measured on ketcher 3.18). Asking the drawing what it contains is the
   only way to know whether the SMILES means what was drawn.
   ════════════════════════════════════════════════════════════════════ */

export interface DrawingReport {
  /**
   * Identity of the drawing's content. Two readings with the same fingerprint
   * show the same atoms, bonds and positions — selection is ignored.
   */
  fingerprint: string;
  atomCount: number;
  /** Reaction arrows or "+" signs are on the canvas. */
  hasReaction: boolean;
  /** Features only a query (SMARTS) can express, as phrases for a message. Empty for a specific molecule. */
  queryFeatures: string[];
}

interface KetAtom {
  type?: string;
  label?: string;
  notList?: boolean;
  queryProperties?: Record<string, unknown>;
}

interface KetBond {
  type?: number;
  customQuery?: string;
  topology?: number;
  center?: number;
}

interface KetNode {
  $ref?: string;
  type?: string;
}

/** KET bond types 5–8: single-or-double, single-or-aromatic, double-or-aromatic, any. */
const QUERY_BOND_TYPES: Record<number, string> = {
  5: 'a “single or double” bond',
  6: 'a “single or aromatic” bond',
  7: 'a “double or aromatic” bond',
  8: 'an “any” bond',
};

/**
 * One- or two-letter labels that look like element symbols but are Ketcher's
 * generic atoms (A any atom, Q heteroatom, X halogen, M metal, G group, R, L).
 * D and T are deuterium and tritium, which SMILES writes as isotopes.
 */
const GENERIC_LABELS = new Set(['A', 'Q', 'X', 'M', 'G', 'R', 'L']);

const isElementLabel = (label: string) => /^[A-Z][a-z]?$/.test(label) && !GENERIC_LABELS.has(label);

function atomFeature(atom: KetAtom): string | null {
  if (atom.type === 'atom-list') return atom.notList ? 'a “not” atom list' : 'an atom list';
  if (atom.type === 'rg-label') return 'an R-group label';
  if (typeof atom.label === 'string' && !isElementLabel(atom.label)) return `the generic atom “${atom.label}”`;
  if (atom.queryProperties && Object.keys(atom.queryProperties).length > 0) return 'atom query properties';
  return null;
}

function bondFeature(bond: KetBond): string | null {
  if (bond.customQuery) return 'a custom query bond';
  if (bond.type !== undefined && QUERY_BOND_TYPES[bond.type]) return QUERY_BOND_TYPES[bond.type]!;
  if (bond.topology) return 'a ring/chain bond constraint';
  if (bond.center) return 'a reacting-centre mark';
  return null;
}

/**
 * Reads a KET document. Throws on anything that is not KET — the caller treats
 * that as "the editor couldn't read this drawing", never as an empty canvas.
 */
export function inspectDrawing(ket: string): DrawingReport {
  const doc = JSON.parse(ket) as Record<string, unknown> & { root?: { nodes?: KetNode[] } };
  const nodes = doc.root?.nodes;
  if (!Array.isArray(nodes)) throw new Error('Not a KET document');

  let atomCount = 0;
  let hasReaction = false;
  const features = new Set<string>();

  for (const node of nodes) {
    if (node.type && /arrow|plus/i.test(node.type)) hasReaction = true;
    if (!node.$ref) continue;
    const molecule = doc[node.$ref] as { type?: string; atoms?: KetAtom[]; bonds?: KetBond[] } | undefined;
    if (!molecule || molecule.type !== 'molecule') continue;
    for (const atom of molecule.atoms ?? []) {
      atomCount += 1;
      const feature = atomFeature(atom);
      if (feature) features.add(feature);
    }
    for (const bond of molecule.bonds ?? []) {
      const feature = bondFeature(bond);
      if (feature) features.add(feature);
    }
  }

  return {
    fingerprint: JSON.stringify(doc, (key, value: unknown) => (key === 'selected' ? undefined : value)),
    atomCount,
    hasReaction,
    queryFeatures: [...features],
  };
}

/** "a, b and c" */
export function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) return phrases.join('');
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
}

/**
 * True when `text` uses syntax that only SMARTS has: `~` (any bond), `[#6]`
 * atomic numbers, and the logical operators `!`, `,`, `;`, `&`, `$(` inside brackets.
 *
 * It decides how a substructure query is read. RDKit's SMILES parser accepts
 * some of these — `[#6]~[#6]` parses as two radical carbons joined by an
 * unspecified bond and then matches nothing — so "try SMILES first" alone
 * misreads every pattern the structure editor writes.
 */
export function hasSmartsSyntax(text: string): boolean {
  // A CXSMILES extension (` |…|`) is punctuation-heavy but is not part of the pattern.
  const core = text.trim().replace(/\s+\|.*\|$/, '');
  if (core.includes('~') || core.includes('$(')) return true;
  return /\[[^\]]*(#\d|[!,;&])[^\]]*\]/.test(core) || /[-=#:@/\\][,;]|[,;!][-=#:@]/.test(core);
}
