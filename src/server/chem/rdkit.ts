import 'server-only';
import type { MainModule as RDKitModule, Mol } from '@rdkit/rdkit';
import { hasSmartsSyntax } from '@/lib/drawing';
import { countMolJson, formatHill } from '@/lib/formula';
import { MAX_STRUCTURE_LENGTH } from '@/lib/validation';

/* ════════════════════════════════════════════════════════════════════
   Chemistry service — RDKit.js (WASM) on the Node runtime.

   Structures are parsed, canonicalised and depicted on the server so the
   browser never downloads the 7 MB WASM binary. The module is loaded
   once per process and held on globalThis (same reason as the store: a
   module-level variable would reload on every hot-reload edit).

   Two rules that will bite if ignored:
   1. Every Mol is WASM heap memory. Always release it — use `withMol`,
      never call `get_mol` and forget `.delete()`.
   2. `@rdkit/rdkit` must stay in `serverExternalPackages` (next.config.ts)
      so it's required from node_modules at runtime and can locate its
      `.wasm` file next to its JS.
   ════════════════════════════════════════════════════════════════════ */

declare global {
  // eslint-disable-next-line no-var
  var __astraRDKit: Promise<RDKitModule> | undefined;
}

export { MAX_STRUCTURE_LENGTH };

export function loadRDKit(): Promise<RDKitModule> {
  if (!globalThis.__astraRDKit) {
    globalThis.__astraRDKit = import('@rdkit/rdkit')
      .then(({ default: init }) => init())
      .catch((error: unknown) => {
        // Don't cache a failed load — let the next call retry.
        globalThis.__astraRDKit = undefined;
        throw error;
      });
  }
  return globalThis.__astraRDKit;
}

/**
 * A WebAssembly trap (stack overflow, out-of-bounds) leaves the module's heap in an
 * unknown state, and the singleton is shared by every request. Drop it so the next
 * call loads a fresh one, instead of failing every structure request until restart.
 *
 * A RangeError counts: when the JavaScript stack runs out before the WASM one, V8
 * unwinds through RDKit's frames with "Maximum call stack size exceeded" — no
 * destructors run, the stack pointer is never restored, and every later call on
 * that module traps (measured with a 20 000-atom chain).
 */
export function recoverFromTrap(error: unknown): boolean {
  const trapped = (typeof WebAssembly !== 'undefined' && error instanceof WebAssembly.RuntimeError) || error instanceof RangeError;
  if (trapped) {
    globalThis.__astraRDKit = undefined;
    return true;
  }
  return false;
}

/**
 * Parses a molecule, runs `fn`, and always frees the WASM memory. Returns null for
 * unparseable input — and for input RDKit cannot process without trapping, which
 * callers report as "not a valid structure" (a 422), never a 500.
 */
export async function withMol<T>(smiles: string, fn: (mol: Mol, rdkit: RDKitModule) => T): Promise<T | null> {
  const input = smiles.trim();
  if (!input || input.length > MAX_STRUCTURE_LENGTH) return null;
  const rdkit = await loadRDKit();
  let mol: Mol | null = null;
  try {
    mol = rdkit.get_mol(input);
    return mol && mol.is_valid() ? fn(mol, rdkit) : null;
  } catch (error) {
    recoverFromTrap(error);
    return null;
  } finally {
    try {
      mol?.delete();
    } catch {
      /* the module was just discarded; there is nothing left to free */
    }
  }
}

export interface StructureInfo {
  /** RDKit canonical SMILES — the stored form. */
  canonicalSmiles: string;
  /** Standard InChIKey — identity for duplicate detection. Empty when InChI generation fails (e.g. some organometallics). */
  inchiKey: string;
  /** Hill formula of the whole structure, all components summed (e.g. salts, hydrates). */
  formula: string;
  /** Average molecular weight, 2 dp. */
  molecularWeight: number;
}

/** Canonicalises a SMILES string and derives identity and formula. Null if it doesn't parse. */
export function describeStructure(smiles: string): Promise<StructureInfo | null> {
  return withMol(smiles, (mol, rdkit) => {
    const inchi = mol.get_inchi();
    const descriptors = JSON.parse(mol.get_descriptors()) as { amw: number };
    return {
      canonicalSmiles: mol.get_smiles(),
      inchiKey: inchi ? rdkit.get_inchikey_for_inchi(inchi) : '',
      formula: hillFormula(mol),
      molecularWeight: Math.round(descriptors.amw * 100) / 100,
    };
  });
}

/* ── Calculated properties ──────────────────────────────────────── */

export interface StructureProperties {
  /** Hill formula, all components summed. */
  formula: string;
  /** Average molecular weight, g/mol, 2 dp. */
  molecularWeight: number;
  /** Monoisotopic mass, 4 dp — what a mass spectrometer reports. */
  exactMass: number;
  /** Mass percentage of each element, in Hill order. Empty if an element's weight is unknown. */
  composition: Array<{ symbol: string; percent: number }>;
  /** Wildman–Crippen estimate of the octanol/water partition coefficient. An estimate, not a measurement. */
  logP: number;
  /** Topological polar surface area, Å². */
  tpsa: number;
  hBondDonors: number;
  hBondAcceptors: number;
  rotatableBonds: number;
  rings: number;
  aromaticRings: number;
  heavyAtoms: number;
  stereoCentres: number;
}

/** Standard atomic weights, read from RDKit once per element rather than typed in by hand. */
const atomicWeights = new Map<string, number>();

function atomicWeight(rdkit: RDKitModule, symbol: string): number | null {
  const known = atomicWeights.get(symbol);
  if (known !== undefined) return known;
  if (!/^[A-Z][a-z]?$/.test(symbol)) return null;
  let atom: Mol | null = null;
  try {
    atom = rdkit.get_mol(`[${symbol}]`);
    if (!atom || !atom.is_valid()) return null;
    const weight = (JSON.parse(atom.get_descriptors()) as { amw: number }).amw;
    atomicWeights.set(symbol, weight);
    return weight;
  } finally {
    atom?.delete();
  }
}

/**
 * The numbers a chemist reads off a structure — ChemDraw's "Analysis" window plus
 * the usual drug-likeness descriptors. Everything is calculated from the atoms and
 * bonds; nothing is looked up, so a novel structure gets the same treatment as a
 * catalogue one. Null if the SMILES doesn't parse.
 */
export function structureProperties(smiles: string): Promise<StructureProperties | null> {
  return withMol(smiles, (mol, rdkit) => {
    if (mol.get_num_atoms() === 0) return null;
    const d = JSON.parse(mol.get_descriptors()) as Record<string, number>;
    const counts = countMolJson(mol.get_json());
    const formula = formatHill(counts);

    // Element order as written in the formula; percentages from the same weights RDKit sums for `amw`.
    const masses: Array<{ symbol: string; mass: number }> = [];
    for (const [, symbol] of formula.matchAll(/([A-Z][a-z]?)\d*/g)) {
      const weight = atomicWeight(rdkit, symbol!);
      if (weight === null) {
        masses.length = 0;
        break;
      }
      masses.push({ symbol: symbol!, mass: weight * (counts.get(symbol!) ?? 0) });
    }
    const total = masses.reduce((sum, m) => sum + m.mass, 0);
    const round = (value: number, dp: number) => Math.round(value * 10 ** dp) / 10 ** dp;

    return {
      formula,
      molecularWeight: round(d.amw!, 2),
      exactMass: round(d.exactmw!, 4),
      composition: total > 0 ? masses.map((m) => ({ symbol: m.symbol, percent: round((m.mass / total) * 100, 2) })) : [],
      logP: round(d.CrippenClogP!, 2),
      tpsa: round(d.tpsa!, 2),
      hBondDonors: d.NumHBD!,
      hBondAcceptors: d.NumHBA!,
      rotatableBonds: d.NumRotatableBonds!,
      rings: d.NumRings!,
      aromaticRings: d.NumAromaticRings!,
      heavyAtoms: d.NumHeavyAtoms!,
      stereoCentres: d.NumAtomStereoCenters!,
    };
  });
}

/* ── Checking a drawing ─────────────────────────────────────────── */

export interface CheckedStructure {
  kind: 'SMILES' | 'SMARTS';
  /** Canonical SMILES, or the SMARTS pattern as written. */
  structure: string;
}

/**
 * Confirms that RDKit can read what the structure editor wrote, before the editor
 * closes. Returns canonical SMILES for a molecule; with `allowQuery`, a pattern
 * that is (or can only be) SMARTS is accepted as written. Null if neither reads.
 *
 * The order — SMARTS first when the text uses SMARTS-only syntax, otherwise SMILES
 * first — is the same one structure search applies (`parseQuery`), so a drawing
 * is searched for exactly as it was checked.
 */
export async function checkStructure(text: string, allowQuery: boolean): Promise<CheckedStructure | null> {
  const input = text.trim();
  if (!input || input.length > MAX_STRUCTURE_LENGTH) return null;

  if (!(allowQuery && hasSmartsSyntax(input))) {
    const canonical = await withMol(input, (mol) => (mol.get_num_atoms() > 0 ? mol.get_smiles() : null));
    if (canonical) return { kind: 'SMILES', structure: canonical };
    if (!allowQuery) return null;
  }

  const rdkit = await loadRDKit();
  let pattern: Mol | null = null;
  try {
    pattern = rdkit.get_qmol(input);
    return pattern && pattern.is_valid() && pattern.get_num_atoms() > 0 ? { kind: 'SMARTS', structure: input } : null;
  } catch (error) {
    recoverFromTrap(error);
    return null;
  } finally {
    try {
      pattern?.delete();
    } catch {
      /* the module was just discarded; there is nothing left to free */
    }
  }
}

/* ── Formula ────────────────────────────────────────────────────── */

/**
 * Hill-order formula counted from the actual atoms.
 *
 * Not taken from the InChI: InChI neutralises charged components, so
 * Pd(OAc)₂ would come out as 2×acetic acid + Pd — two hydrogens too many.
 */
export function hillFormula(mol: Mol): string {
  return formatHill(countMolJson(mol.get_json()));
}

/* ── Editor interchange ─────────────────────────────────────────── */

/**
 * A 2D molfile of `smiles` for the structure editor, or null if it doesn't parse.
 *
 * The editor is loaded from a molfile rather than a SMILES string. Ketcher's own
 * SMILES import invents E/Z geometry for unspecified double bonds and drops
 * isotope/charge detail on some inputs; a molfile from RDKit avoids that (456 of
 * 465 test structures round-trip identically, against 427 via SMILES). Double bonds
 * with unspecified stereo are written "either" so the editor keeps them unspecified,
 * and the counts line carries the absolute-stereo flag so stereocentres stay set.
 *
 * CoordGen draws nicer layouts but does not terminate on macrocycles (a 40-membered
 * ring never returns, and it blocks the event loop), so rings of 30+ atoms fall back
 * to RDKit's own depictor.
 */
export function molfileFor(smiles: string): Promise<string | null> {
  return withMol(smiles, (mol, rdkit) => {
    let macrocycle = false;
    const query = rdkit.get_qmol('[r{30-}]');
    if (query) {
      try {
        macrocycle = mol.get_substruct_match(query) !== '{}';
      } finally {
        query.delete();
      }
    }
    mol.set_new_coords(!macrocycle);
    const lines = mol.get_molblock().split('\n');
    // V2000 counts line: columns 12–14 hold the chiral flag.
    if (lines[3] && /V2000/.test(lines[3])) lines[3] = lines[3].slice(0, 12) + '  1' + lines[3].slice(15);
    return lines.join('\n');
  });
}

/* ── Depiction ──────────────────────────────────────────────────── */

/** Sentinel highlight colour (pure magenta) — swapped for a theme token after drawing. */
const HIGHLIGHT_SENTINEL: [number, number, number] = [1, 0, 1];

export interface DepictOptions {
  width?: number;
  height?: number;
  /** Atom / bond indices to highlight, e.g. from a substructure match. */
  highlight?: { atoms: number[]; bonds: number[] };
}

/**
 * Draws a structure as an inline-safe SVG string, or null if it doesn't parse.
 *
 * RDKit draws CPK element colours on a white rectangle. We draw with no
 * background and rewrite every colour to `currentColor`, so the
 * structure inherits text colour and works in light and dark themes
 * without introducing colour tokens. Highlights are drawn behind the bonds
 * in the primary tint (--vbds-primary-border), so the fragment stays legible.
 */
export function depictStructure(smiles: string, options: DepictOptions = {}): Promise<string | null> {
  const { width = 240, height = 180, highlight } = options;
  return withMol(smiles, (mol) => {
    const svg = mol.get_svg_with_highlights(
      JSON.stringify({
        width,
        height,
        clearBackground: false,
        // Cap the scale-up so a 4-atom molecule isn't drawn giant next to a 40-atom one;
        // large molecules still shrink to fit. Based on the limiting dimension so a
        // short, wide box (result cards) scales the same as a 4:3 one.
        fixedBondLength: Math.round(Math.min(width, height * (4 / 3)) / 7),
        bondLineWidth: 1.5,
        highlightBondWidthMultiplier: 14,
        padding: 0.08,
        addStereoAnnotation: true,
        highlightColour: HIGHLIGHT_SENTINEL,
        ...(highlight ? { atoms: highlight.atoms, bonds: highlight.bonds } : {}),
      }),
    );
    return themeSvg(svg);
  }).then((svg) => (svg && UNSAFE_SVG.test(svg) ? null : svg));
}

/**
 * The SVG is rendered inline (it must be, for currentColor theming), so
 * refuse anything script-capable. RDKit draws labels as paths and never
 * echoes input text — verified against CXSMILES label injection — so this
 * is a backstop against a future RDKit change, not the primary control.
 */
const UNSAFE_SVG = /<script|<foreignObject|<iframe|<object|<embed|\son[a-z]+\s*=|javascript:/i;

/** Strips the XML prolog, makes the SVG responsive, and maps colours to theme values. */
function themeSvg(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>\s*/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s(width|height)='\d+px'/g, '')
    .replace(/#FF00FF/gi, 'var(--vbds-primary-border)')
    .replace(/#[0-9A-F]{6}/gi, 'currentColor');
}
