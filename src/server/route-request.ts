import 'server-only';
import { routeSchema } from '@/lib/validation';
import { resolveStructureInput } from './chem/structure-input';
import type { RouteWriteInput } from './repo/contract';

/**
 * Parses a route create/update body into what the repository stores:
 * schema-validated, empty strings normalised away, and each external
 * SMILES canonicalised by RDKit — a bad one is a 422 pointed at its row
 * (`inputs.2.externalSmiles`), the same envelope the forms understand.
 */
export async function parseRouteRequest(body: unknown): Promise<RouteWriteInput> {
  const parsed = routeSchema.parse(body);

  const inputs = await Promise.all(
    parsed.inputs.map(async (input, index) => {
      const structure = input.productId
        ? {}
        : await resolveStructureInput(input.externalSmiles || undefined, ['inputs', index, 'externalSmiles']);
      return {
        role: input.role,
        productId: input.productId || undefined,
        externalName: input.productId ? undefined : input.externalName || undefined,
        externalCas: input.productId ? undefined : input.externalCas || undefined,
        externalSmiles: structure.smiles || undefined,
        quantity: input.quantity || undefined,
      };
    }),
  );

  return {
    name: parsed.name,
    isPreferred: parsed.isPreferred,
    reviewStatus: parsed.reviewStatus,
    notes: parsed.notes || undefined,
    inputs,
  };
}
