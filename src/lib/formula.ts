/* ════════════════════════════════════════════════════════════════════
   Molecular formula helpers — framework-free, safe on client and server.

   Element counts are the unit of comparison, so differently written
   formulas compare equal: 'SOCl2' ≡ 'Cl2OS', 'C6H5N3O·H2O' ≡ 'C6H7N3O2'.
   ════════════════════════════════════════════════════════════════════ */

export type ElementCounts = Map<string, number>;

// prettier-ignore
const ELEMENTS = ['', 'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca',
  'Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr','Rb','Sr','Y','Zr','Nb','Mo','Tc',
  'Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe','Cs','Ba','La','Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy',
  'Ho','Er','Tm','Yb','Lu','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn'];

function add(counts: ElementCounts, symbol: string, n: number): void {
  if (n) counts.set(symbol, (counts.get(symbol) ?? 0) + n);
}

/**
 * Parses a written formula into element counts. Handles hydrate / salt
 * separators ('·', '.') with an optional leading multiplier ('CuSO4·5H2O').
 * Returns null for anything it can't read, including parentheses and charges.
 */
export function parseFormula(formula: string): ElementCounts | null {
  const counts: ElementCounts = new Map();
  for (const part of formula.trim().split(/[·.]/)) {
    const match = /^(\d*)((?:[A-Z][a-z]?\d*)+)$/.exec(part);
    if (!match) return null;
    const multiplier = match[1] ? Number(match[1]) : 1;
    for (const [, symbol, n] of match[2].matchAll(/([A-Z][a-z]?)(\d*)/g)) {
      add(counts, symbol, (n ? Number(n) : 1) * multiplier);
    }
  }
  return counts;
}

interface MolJsonAtom {
  z?: number;
  impHs?: number;
}

/** Counts elements from RDKit's `get_json()` output — real atoms, so charged components stay correct. */
export function countMolJson(json: string): ElementCounts {
  const parsed = JSON.parse(json) as {
    defaults: { atom: Required<MolJsonAtom> };
    molecules: Array<{ atoms: MolJsonAtom[] }>;
  };
  const defaults = parsed.defaults.atom;
  const counts: ElementCounts = new Map();
  for (const atom of parsed.molecules.flatMap((m) => m.atoms)) {
    const z = atom.z ?? defaults.z;
    add(counts, ELEMENTS[z] ?? `Z${z}`, 1);
    add(counts, 'H', atom.impHs ?? defaults.impHs);
  }
  return counts;
}

/** Hill order: C, then H, then alphabetical — or fully alphabetical when there's no carbon. */
export function formatHill(counts: ElementCounts): string {
  const symbols = [...counts.keys()].sort();
  const ordered = counts.has('C')
    ? ['C', ...(counts.has('H') ? ['H'] : []), ...symbols.filter((s) => s !== 'C' && s !== 'H')]
    : symbols;
  return ordered.map((s) => `${s}${counts.get(s) === 1 ? '' : counts.get(s)}`).join('');
}

/** True when two formulas describe the same element counts, however they're written. */
export function sameFormula(a: string, b: string): boolean {
  const ca = parseFormula(a);
  const cb = parseFormula(b);
  return ca !== null && cb !== null && formatHill(ca) === formatHill(cb);
}
