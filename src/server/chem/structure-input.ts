import 'server-only';
import { ZodError } from 'zod';
import { describeStructure } from './rdkit';

/**
 * Turns a user-supplied SMILES into what the repository stores.
 *
 *   undefined → {}                          leave the structure unchanged
 *   ''        → { smiles: '', inchiKey: '' } clear it
 *   valid     → canonical SMILES + InChIKey
 *   invalid   → throws ZodError on `smiles`, which handleError maps to the
 *               same 422 field-error envelope as schema validation
 *
 * Canonicalising here — not in the Zod schema — is deliberate: the schema
 * also runs in the browser, and RDKit only runs on the server.
 */
export async function resolveStructureInput(
  smiles: string | undefined,
): Promise<{ smiles?: string; inchiKey?: string }> {
  if (smiles === undefined) return {};
  if (smiles.trim() === '') return { smiles: '', inchiKey: '' };

  const info = await describeStructure(smiles);
  if (!info) {
    throw new ZodError([
      { code: 'custom', path: ['smiles'], message: 'Not a valid structure — check the SMILES string', input: smiles },
    ]);
  }
  return { smiles: info.canonicalSmiles, inchiKey: info.inchiKey };
}
