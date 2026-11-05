import 'server-only';
import { throwFieldError } from '@/server/field-error';
import { describeStructure } from './rdkit';

/**
 * Turns a user-supplied SMILES into what the repository stores.
 *
 *   undefined → {}                          leave the structure unchanged
 *   ''        → { smiles: '', inchiKey: '' } clear it
 *   valid     → canonical SMILES + InChIKey
 *   invalid   → 422 on `path` (default `smiles`), the same field-error
 *               envelope as schema validation
 *
 * Canonicalising here — not in the Zod schema — is deliberate: the schema
 * also runs in the browser, and RDKit only runs on the server.
 */
export async function resolveStructureInput(
  smiles: string | undefined,
  path: Array<string | number> = ['smiles'],
): Promise<{ smiles?: string; inchiKey?: string }> {
  if (smiles === undefined) return {};
  if (smiles.trim() === '') return { smiles: '', inchiKey: '' };

  const info = await describeStructure(smiles);
  if (!info) throwFieldError(path, 'Not a valid structure — check the SMILES string');
  return { smiles: info.canonicalSmiles, inchiKey: info.inchiKey };
}
