import 'server-only';
import { buildSynthesisMap, MAP_DEPTH, type SynthesisMap } from '@/lib/synthesis';
import type { SynthesisRouteView, WhereUsedEntry } from '@/lib/types';
import { repo } from './repo';

const preferredOf = (routes: SynthesisRouteView[]) => routes.find((r) => r.isPreferred) ?? routes[0];

/**
 * Gathers what the synthesis map needs, then hands off to the pure
 * builder. Upstream is fetched level by level — each level's routes in
 * parallel — only as deep as the map draws (MAP_DEPTH); the deepest
 * layer's inputs are drawn but not expanded, so their routes aren't fetched.
 */
export async function loadSynthesisMap(
  focus: { id: string; name: string; slug: string },
  focusRoutes: SynthesisRouteView[],
  whereUsed: WhereUsedEntry[],
): Promise<SynthesisMap> {
  const routeByProduct = new Map<string, SynthesisRouteView | undefined>([[focus.id, preferredOf(focusRoutes)]]);

  let frontier = [focus.id];
  for (let depth = 1; depth < MAP_DEPTH && frontier.length; depth += 1) {
    const discovered = [
      ...new Set(
        frontier.flatMap((id) =>
          (routeByProduct.get(id)?.inputs ?? []).flatMap((input) => (input.product ? [input.product.id] : [])),
        ),
      ),
    ].filter((id) => !routeByProduct.has(id));

    const routes = await Promise.all(discovered.map((id) => repo.listRoutes(id)));
    discovered.forEach((id, i) => routeByProduct.set(id, preferredOf(routes[i]!)));
    frontier = discovered;
  }

  return buildSynthesisMap({ focus, routeFor: (id) => routeByProduct.get(id), whereUsed });
}
