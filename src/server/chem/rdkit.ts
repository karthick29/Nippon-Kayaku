import 'server-only';
import type { MainModule as RDKitModule, Mol } from '@rdkit/rdkit';

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

/** Hard cap on SMILES / SMARTS input — bounds parse and match cost. */
export const MAX_STRUCTURE_LENGTH = 1000;

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

/** Parses a molecule, runs `fn`, and always frees the WASM memory. Returns null for unparseable input. */
export async function withMol<T>(smiles: string, fn: (mol: Mol, rdkit: RDKitModule) => T): Promise<T | null> {
  const input = smiles.trim();
  if (!input || input.length > MAX_STRUCTURE_LENGTH) return null;
  const rdkit = await loadRDKit();
  const mol = rdkit.get_mol(input);
  if (!mol) return null;
  try {
    return mol.is_valid() ? fn(mol, rdkit) : null;
  } finally {
    mol.delete();
  }
}

export interface StructureInfo {
  /** RDKit canonical SMILES — the stored form. */
  canonicalSmiles: string;
  /** Standard InChIKey — identity for duplicate detection. Empty when InChI generation fails (e.g. some organometallics). */
  inchiKey: string;
  /** Hill formula from the InChI main layer; multi-component structures are dot-separated. */
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
      formula: inchi.split('/')[1] ?? '',
      molecularWeight: Math.round(descriptors.amw * 100) / 100,
    };
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
 * without introducing colour tokens. Highlights use the ASTRA primary token.
 */
export function depictStructure(smiles: string, options: DepictOptions = {}): Promise<string | null> {
  const { width = 240, height = 180, highlight } = options;
  return withMol(smiles, (mol) => {
    const svg = mol.get_svg_with_highlights(
      JSON.stringify({
        width,
        height,
        clearBackground: false,
        bondLineWidth: 1.5,
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
    .replace(/#FF00FF/gi, 'var(--vbds-primary)')
    .replace(/#[0-9A-F]{6}/gi, 'currentColor');
}
