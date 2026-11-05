import 'server-only';
import { findCycle, type RouteEdge } from '@/lib/synthesis';
import type { AuditLog, SynthesisRoute } from '@/lib/types';
import { throwFieldError } from './field-error';
import type { RouteWriteInput } from './repo/contract';

/* ════════════════════════════════════════════════════════════════════
   Route write rules — shared by both adapters so the in-memory store and
   PostgreSQL enforce exactly the same thing.
   ════════════════════════════════════════════════════════════════════ */

/**
 * Throws a 422 field error, pointed at the offending input row, when:
 *  • an input names a product that isn't an active catalogue product
 *  • a product is listed as an input to its own route
 *  • the route would close a loop (output already used to make an input)
 *
 * `edges` must exclude the route being edited.
 */
export function assertRouteWritable(args: {
  outputId: string;
  input: RouteWriteInput;
  edges: RouteEdge[];
  /** Name of an active (not soft-deleted) catalogue product, or undefined. */
  activeProductName: (id: string) => string | undefined;
}): void {
  const { outputId, input, edges, activeProductName } = args;
  const ids = input.inputs.map((i) => i.productId);

  ids.forEach((id, index) => {
    if (!id) return;
    if (!activeProductName(id)) throwFieldError(['inputs', index, 'productId'], 'That product is not in the catalogue');
    if (id === outputId) throwFieldError(['inputs', index, 'productId'], 'A product can’t be an input to its own route');
  });

  const loop = findCycle(outputId, ids.filter((id): id is string => Boolean(id)), edges);
  if (loop) {
    throwFieldError(
      ['inputs', ids.indexOf(loop), 'productId'],
      `${activeProductName(loop)} is already made from this product, so this route would create a loop`,
    );
  }
}

/** Human-readable input list for audit diffs, e.g. "building-block: Bisphenol A". */
function describeInputs(
  inputs: RouteWriteInput['inputs'],
  productName: (id: string) => string | undefined,
): string {
  return inputs
    .map((i) => `${i.role}: ${i.productId ? (productName(i.productId) ?? i.productId) : i.externalName}`)
    .join('; ');
}

/** Field-level diff for the audit log — the same shape as product edits. */
export function routeChanges(
  before: SynthesisRoute,
  after: RouteWriteInput,
  productName: (id: string) => string | undefined,
): AuditLog['changes'] {
  const changes: NonNullable<AuditLog['changes']> = {};
  const compare = (key: string, from: unknown, to: unknown) => {
    if (from !== to) changes[key] = { from, to };
  };
  compare('name', before.name, after.name);
  compare('isPreferred', before.isPreferred, after.isPreferred);
  compare('reviewStatus', before.reviewStatus, after.reviewStatus);
  compare('notes', before.notes ?? '', after.notes ?? '');
  compare('inputs', describeInputs(before.inputs, productName), describeInputs(after.inputs, productName));
  return Object.keys(changes).length ? changes : undefined;
}

export { describeInputs };
