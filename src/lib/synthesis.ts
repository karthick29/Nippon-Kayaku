import type { RouteInputRole, SynthesisRoute } from './types';

/* ════════════════════════════════════════════════════════════════════
   Synthesis graph — framework-free, shared by both repository adapters.

   Edges run input → output: "X is used to make P". Only catalogue
   inputs are edges; external substances are leaves outside the graph.
   ════════════════════════════════════════════════════════════════════ */

export interface RouteEdge {
  /** The catalogue product used as an input. */
  from: string;
  /** The product the route makes. */
  to: string;
  routeId: string;
  routeName: string;
  role: RouteInputRole;
}

export function routeEdges(routes: Array<Pick<SynthesisRoute, 'id' | 'name' | 'productId' | 'inputs'>>): RouteEdge[] {
  return routes.flatMap((route) =>
    route.inputs
      .filter((input) => input.productId)
      .map((input) => ({
        from: input.productId!,
        to: route.productId,
        routeId: route.id,
        routeName: route.name,
        role: input.role,
      })),
  );
}

export interface TracedConsumer {
  productId: string;
  depth: number;
  routeId: string;
  routeName: string;
  role: RouteInputRole;
  /** Product ids between the origin and this consumer, in order. */
  via: string[];
}

/**
 * Breadth-first walk of everything made from `origin`, directly or through
 * intermediates. Each consumer appears once, at its shortest depth — BFS
 * guarantees the first visit is the shortest chain. Cycles can't loop
 * forever: a visited product is never re-queued.
 */
export function traceConsumers(origin: string, edges: RouteEdge[], maxDepth = Infinity): TracedConsumer[] {
  const outgoing = new Map<string, RouteEdge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }

  const visited = new Set<string>([origin]);
  const found: TracedConsumer[] = [];
  let frontier: Array<{ productId: string; via: string[] }> = [{ productId: origin, via: [] }];

  for (let depth = 1; frontier.length && depth <= maxDepth; depth += 1) {
    const next: typeof frontier = [];
    for (const { productId, via } of frontier) {
      for (const edge of outgoing.get(productId) ?? []) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        const chain = productId === origin ? [] : [...via, productId];
        found.push({ productId: edge.to, depth, routeId: edge.routeId, routeName: edge.routeName, role: edge.role, via: chain });
        next.push({ productId: edge.to, via: chain });
      }
    }
    frontier = next;
  }
  return found;
}

/**
 * Would a route making `output` from `inputIds` close a loop? Adding the
 * edge i → output creates a cycle exactly when `output` is already used,
 * directly or transitively, to make `i` (or i is output itself).
 * Returns the first offending input id, or null.
 *
 * Pass `edges` without the route being edited, so replacing a route's own
 * inputs is never mistaken for a loop with its old self.
 */
export function findCycle(output: string, inputIds: string[], edges: RouteEdge[]): string | null {
  const downstream = new Set(traceConsumers(output, edges).map((c) => c.productId));
  return inputIds.find((id) => id === output || downstream.has(id)) ?? null;
}
