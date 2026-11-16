import type { NextRequest } from 'next/server';
import { fail, ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { MAX_REACTION_LENGTH, parseReaction, type ReactionSpecies } from '@/server/chem/reaction';
import { repo } from '@/server/repo';

export const dynamic = 'force-dynamic';

export interface ReactionInput extends ReactionSpecies {
  /** Set when the structure is a catalogue product (matched on InChIKey). */
  product?: { id: string; name: string; casNumber: string };
}

export interface ReactionReading {
  reactants: ReactionInput[];
  agents: ReactionInput[];
  /**
   * Whether the drawn product is the product this route makes: true, false, or
   * null when it can't be said (nothing drawn on the right, or no stored structure).
   */
  productMatches: boolean | null;
}

/**
 * GET /api/structure/reaction?smiles=&productId=
 * Reads a drawn reaction (reaction SMILES) into route inputs: what is left of the
 * arrow, what is over it, each matched to the catalogue where it can be. Same 422
 * envelope as /depict, on the `smiles` field.
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('product:read');

  const params = request.nextUrl.searchParams;
  const smiles = (params.get('smiles') ?? '').trim();
  if (!smiles || smiles.length > MAX_REACTION_LENGTH) {
    return fail('Validation failed', 422, { fields: { smiles: 'Draw a reaction first' } });
  }
  const parsed = await parseReaction(smiles);
  if ('problem' in parsed) return fail('Validation failed', 422, { fields: { smiles: parsed.problem } });

  const productId = params.get('productId') ?? '';
  const products = await repo.allProducts();
  const byKey = new Map(products.filter((p) => p.inchiKey).map((p) => [p.inchiKey!, p]));
  const output = products.find((p) => p.id === productId);

  const match = (species: ReactionSpecies): ReactionInput => {
    const hit = species.inchiKey ? byKey.get(species.inchiKey) : undefined;
    // A product can't be an input to its own route — leave it as a plain structure.
    return hit && hit.id !== productId
      ? { ...species, product: { id: hit.id, name: hit.name, casNumber: hit.casNumber } }
      : species;
  };

  const productMatches =
    parsed.products.length === 0 || !output?.inchiKey ? null : parsed.products.some((p) => p.inchiKey === output.inchiKey);

  return ok<ReactionReading>({
    reactants: parsed.reactants.map(match),
    agents: parsed.agents.map(match),
    productMatches,
  });
});
