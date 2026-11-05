import type { RouteInputRole, SynthesisRoute, SynthesisRouteView, WhereUsedEntry } from './types';

/* ════════════════════════════════════════════════════════════════════
   Synthesis graph — framework-free, shared by both repository adapters.

   Edges run input → output: "X is used to make P". Only catalogue
   inputs are edges; external substances are leaves outside the graph.
   ════════════════════════════════════════════════════════════════════ */

/* ── Display ────────────────────────────────────────────────────── */

export const ROUTE_ROLE_LABELS: Record<RouteInputRole, string> = {
  'building-block': 'Building block',
  reagent: 'Reagent',
  catalyst: 'Catalyst',
  solvent: 'Solvent',
};

export type SupplyRisk = 'none' | 'single' | 'covered';

/**
 * Supply resilience of a catalogue input, from its mapped supplier count.
 * 0 → nobody can supply it; 1 → single source, one failure stops the
 * route; 2+ → covered. External inputs aren't tracked in ASTRA.
 */
export function supplyRisk(companyCount: number): SupplyRisk {
  if (companyCount === 0) return 'none';
  if (companyCount === 1) return 'single';
  return 'covered';
}

/* ── Graph ──────────────────────────────────────────────────────── */

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

/* ── Synthesis map (diagram) ────────────────────────────────────── */

/** How many steps the map reaches upstream (inputs of inputs) and downstream (uses of uses). */
export const MAP_DEPTH = 3;

export interface MapNode {
  id: string;
  label: string;
  /** Second line: what the node is, in words — never colour alone. */
  detail: string;
  kind: 'focus' | 'catalogue' | 'external';
  /** 0 = the product; negative = upstream inputs; positive = downstream uses. */
  layer: number;
  href?: string;
  risk?: SupplyRisk;
}

export interface MapEdge {
  from: string;
  to: string;
  role: RouteInputRole;
}

export interface SynthesisMap {
  nodes: MapNode[];
  edges: MapEdge[];
}

/**
 * Builds the map around one product.
 *
 *   upstream   — `routeFor(productId)` gives the route to draw for a
 *                product (its preferred one). Catalogue inputs expand
 *                recursively up to MAP_DEPTH; external inputs are leaves.
 *   downstream — where-used entries; each links from its immediate
 *                predecessor (the last `via` step, or the product itself).
 *
 * A catalogue product appears once, at the layer where it was first
 * reached; an extra path to it becomes an extra edge, not a duplicate node.
 */
export function buildSynthesisMap(args: {
  focus: { id: string; name: string; slug: string };
  routeFor: (productId: string) => SynthesisRouteView | undefined;
  whereUsed: WhereUsedEntry[];
}): SynthesisMap {
  const { focus, routeFor, whereUsed } = args;
  const nodes = new Map<string, MapNode>();
  const edges: MapEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (edge: MapEdge) => {
    const key = `${edge.from}>${edge.to}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push(edge);
    }
  };

  nodes.set(focus.id, { id: focus.id, label: focus.name, detail: 'This product', kind: 'focus', layer: 0 });

  // Upstream: breadth-first so each catalogue product lands at its nearest layer.
  let frontier = [focus.id];
  for (let depth = 1; depth <= MAP_DEPTH && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const productId of frontier) {
      const route = routeFor(productId);
      for (const input of route?.inputs ?? []) {
        if (input.product) {
          const id = input.product.id;
          if (!nodes.has(id)) {
            const risk = supplyRisk(input.product.companyCount);
            nodes.set(id, {
              id,
              label: input.product.name,
              detail: `${ROUTE_ROLE_LABELS[input.role]} · ${SUPPLY_WORDS[risk](input.product.companyCount)}`,
              kind: 'catalogue',
              layer: -depth,
              href: `/products/${input.product.slug}?tab=synthesis`,
              risk,
            });
            next.push(id);
          }
          addEdge({ from: id, to: productId, role: input.role });
        } else {
          // External substances are per-route leaves: the same name in two routes is two facts.
          const id = `ext:${input.id}`;
          nodes.set(id, {
            id,
            label: input.externalName ?? 'Unnamed input',
            detail: `${ROUTE_ROLE_LABELS[input.role]} · External`,
            kind: 'external',
            layer: -depth,
          });
          addEdge({ from: id, to: productId, role: input.role });
        }
      }
    }
    frontier = next;
  }

  // Downstream: where-used is already shortest-chain-per-product.
  for (const entry of whereUsed.filter((e) => e.depth <= MAP_DEPTH)) {
    const id = entry.product.id;
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        label: entry.product.name,
        detail: `Uses it${entry.depth > 1 ? ` · ${entry.depth} steps` : ''} · ${entry.product.status}`,
        kind: 'catalogue',
        layer: entry.depth,
        href: `/products/${entry.product.slug}?tab=synthesis`,
      });
    }
    const from = entry.via.length ? entry.via[entry.via.length - 1]!.id : focus.id;
    addEdge({ from, to: id, role: entry.role });
  }

  return { nodes: [...nodes.values()], edges };
}

const SUPPLY_WORDS: Record<SupplyRisk, (count: number) => string> = {
  none: () => 'No supplier',
  single: () => 'Single source',
  covered: (count) => `${count} suppliers`,
};

export interface PlacedNode extends MapNode {
  x: number;
  y: number;
}

export interface MapLayout {
  nodes: PlacedNode[];
  edges: MapEdge[];
  width: number;
  height: number;
  node: { width: number; height: number };
}

const NODE_W = 196;
const NODE_H = 46;
const COL_GAP = 64;
const ROW_GAP = 14;
const PAD = 12;

/**
 * Layered left-to-right layout. Columns are layers; within a column,
 * nodes are ordered by the mean position of their already-placed
 * neighbours (one barycentre sweep outward from the product), which
 * removes most edge crossings in graphs this size. Columns are centred
 * vertically on the tallest one.
 */
export function layoutSynthesisMap(map: SynthesisMap): MapLayout {
  const layers = [...new Set(map.nodes.map((n) => n.layer))].sort((a, b) => a - b);
  const byLayer = new Map(layers.map((l) => [l, map.nodes.filter((n) => n.layer === l)]));
  const tallest = Math.max(...layers.map((l) => byLayer.get(l)!.length));
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP;
  const rowY = new Map<string, number>();

  const place = (layer: number) => {
    const column = byLayer.get(layer)!;
    const top = (height - (column.length * NODE_H + (column.length - 1) * ROW_GAP)) / 2;
    column.forEach((node, i) => rowY.set(node.id, top + i * (NODE_H + ROW_GAP)));
  };
  const barycentre = (node: MapNode, neighbourLayer: number) => {
    const ys = map.edges
      .filter((e) => e.from === node.id || e.to === node.id)
      .map((e) => (e.from === node.id ? e.to : e.from))
      .filter((id) => map.nodes.find((n) => n.id === id)?.layer === neighbourLayer && rowY.has(id))
      .map((id) => rowY.get(id)!);
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Number.POSITIVE_INFINITY;
  };

  place(0);
  for (const direction of [-1, 1]) {
    for (let layer = direction; byLayer.has(layer); layer += direction) {
      const column = byLayer.get(layer)!;
      const keyed = column.map((node, index) => ({ node, index, key: barycentre(node, layer - direction) }));
      // Stable: ties keep insertion (route) order.
      keyed.sort((a, b) => a.key - b.key || a.index - b.index);
      byLayer.set(layer, keyed.map((k) => k.node));
      place(layer);
    }
  }

  const minLayer = layers[0]!;
  const nodes = map.nodes.map((node) => ({
    ...node,
    x: PAD + (node.layer - minLayer) * (NODE_W + COL_GAP),
    y: rowY.get(node.id)!,
  }));
  return {
    nodes,
    edges: map.edges,
    width: PAD * 2 + layers.length * NODE_W + (layers.length - 1) * COL_GAP,
    height,
    node: { width: NODE_W, height: NODE_H },
  };
}
