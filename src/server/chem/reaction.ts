import 'server-only';
import { describeStructure, MAX_STRUCTURE_LENGTH } from './rdkit';

/* ════════════════════════════════════════════════════════════════════
   Reading a drawn reaction.

   The structure editor writes a reaction as reaction SMILES —
   `reactants>agents>products`, components separated by dots. ASTRA does
   not store that string: a route is a list of inputs with roles, and the
   scheme on the Synthesis tab is drawn from those. This module turns a
   drawing into that list, so drawing is a faster way to fill the form,
   not a second representation that could disagree with it.
   ════════════════════════════════════════════════════════════════════ */

export const MAX_REACTION_LENGTH = 2000;
const MAX_COMPONENTS = 30;

export interface ReactionSpecies {
  /** RDKit canonical SMILES. */
  smiles: string;
  inchiKey: string;
  formula: string;
}

export interface ParsedReaction {
  reactants: ReactionSpecies[];
  /** Drawn over or under the arrow. */
  agents: ReactionSpecies[];
  products: ReactionSpecies[];
}

/** Net formal charge written in a SMILES fragment's bracket atoms: `[Na+]` → 1, `[O-]` → -1, `[Fe+3]` → 3. */
function writtenCharge(fragment: string): number {
  let total = 0;
  for (const [, signs, count] of fragment.matchAll(/\[[^\]]*?([+-]+)(\d*)(?::\d+)?\]/g)) {
    const sign = signs![0] === '+' ? 1 : -1;
    total += sign * (count ? Number(count) : signs!.length);
  }
  return total;
}

/**
 * Splits one side of a reaction into substances.
 *
 * A dot separates fragments, and reaction SMILES has no way to say that two
 * fragments are one substance — so sodium hydroxide arrives as `[Na+].[OH-]`,
 * indistinguishable from two reactants. Ions are regrouped when the charged
 * fragments on a side balance to zero: that keeps a salt as one input, which is
 * how every seeded route records it. Two different salts on one side would be
 * merged too; the form shows the result, so it can be split by hand.
 */
function substances(side: string): string[] {
  const fragments = side.split('.').filter(Boolean);
  const neutral = fragments.filter((f) => writtenCharge(f) === 0);
  const ions = fragments.filter((f) => writtenCharge(f) !== 0);
  if (ions.length > 1 && ions.reduce((sum, f) => sum + writtenCharge(f), 0) === 0) {
    return [...neutral, ions.join('.')];
  }
  return fragments;
}

/**
 * Parses reaction SMILES into canonical species. Returns a message instead when
 * it isn't a usable reaction — the caller shows it while the drawing is still open.
 */
export async function parseReaction(text: string): Promise<ParsedReaction | { problem: string }> {
  // An extended-SMILES suffix (` |…|`) carries layout only.
  const input = text.trim().split(/\s/)[0] ?? '';
  if (!input || input.length > MAX_REACTION_LENGTH) return { problem: 'This reaction is too large to read.' };
  const sides = input.split('>');
  if (sides.length !== 3) return { problem: 'Draw one reaction arrow, with what goes in on its left and what comes out on its right.' };

  const [left, middle, right] = sides.map(substances) as [string[], string[], string[]];
  if (left.length === 0) return { problem: 'Nothing is drawn on the left of the arrow.' };
  if (left.length + middle.length + right.length > MAX_COMPONENTS) {
    return { problem: `A route holds up to ${MAX_COMPONENTS} substances — this drawing has more.` };
  }

  const read = async (list: string[], where: string): Promise<ReactionSpecies[] | { problem: string }> => {
    const species: ReactionSpecies[] = [];
    const seen = new Set<string>();
    for (const smiles of list) {
      const info = smiles.length <= MAX_STRUCTURE_LENGTH ? await describeStructure(smiles) : null;
      if (!info) return { problem: `One of the structures ${where} the arrow isn’t a molecule ASTRA can read. Look for atoms with too many bonds.` };
      // The same molecule drawn twice (2 equivalents) is one input.
      if (seen.has(info.canonicalSmiles)) continue;
      seen.add(info.canonicalSmiles);
      species.push({ smiles: info.canonicalSmiles, inchiKey: info.inchiKey, formula: info.formula });
    }
    return species;
  };

  const reactants = await read(left, 'left of');
  if ('problem' in reactants) return reactants;
  const agents = await read(middle, 'over');
  if ('problem' in agents) return agents;
  const products = await read(right, 'right of');
  if ('problem' in products) return products;
  return { reactants, agents, products };
}
