import { layoutSynthesisMap, type PlacedNode, type SynthesisMap } from '@/lib/synthesis';
import { cx } from '@/lib/cn';

/* ════════════════════════════════════════════════════════════════════
   Synthesis map — server-rendered SVG, no client JavaScript.

   Inputs on the left, the product in the middle, products made from it
   on the right. Encoding never relies on colour alone: the dashed
   outline (external) and the risk borders are repeated in each node's
   second line of text, and the Made from / Used in tables below remain
   the full, accessible detail view.

   Colours come from tokens via CSS classes (.astra-map__*), so the map
   themes with light/dark like the rest of the app.
   ════════════════════════════════════════════════════════════════════ */

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function SynthesisMapDiagram({ map, productName }: { map: SynthesisMap; productName: string }) {
  const layout = layoutSynthesisMap(map);
  const { width, height, node: size } = layout;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const upstream = layout.nodes.filter((n) => n.layer < 0).length;
  const downstream = layout.nodes.filter((n) => n.layer > 0).length;

  return (
    <div className="astra-map-wrap">
      <div className="astra-scroll-x">
        <svg
          className="astra-map"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-labelledby="synthesis-map-title synthesis-map-desc"
        >
          {/* Single-string children only: mixed JSX children put <!-- --> text separators
              inside <title>/<desc>, and the server and client trees then disagree (hydration error). */}
          <title id="synthesis-map-title">{`Synthesis map for ${productName}`}</title>
          <desc id="synthesis-map-desc">
            {`${upstream} ${upstream === 1 ? 'input' : 'inputs'} upstream and ${downstream} ${downstream === 1 ? 'product' : 'products'} made from it downstream. The tables below list the same information.`}
          </desc>
          <defs>
            <marker
              id="astra-map-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 z" className="astra-map__arrowhead" />
            </marker>
          </defs>

          <g aria-hidden="true">
            {layout.edges.map((edge) => {
              const from = byId.get(edge.from);
              const to = byId.get(edge.to);
              if (!from || !to) return null;
              const x1 = from.x + size.width;
              const y1 = from.y + size.height / 2;
              const x2 = to.x - 2;
              const y2 = to.y + size.height / 2;
              const mid = (x1 + x2) / 2;
              return (
                <path
                  key={`${edge.from}>${edge.to}`}
                  d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                  className="astra-map__edge"
                  markerEnd="url(#astra-map-arrow)"
                />
              );
            })}
          </g>

          <g>
            {layout.nodes.map((n) => (
              <MapNode key={n.id} node={n} width={size.width} height={size.height} />
            ))}
          </g>
        </svg>
      </div>

      <ul className="astra-map-legend" aria-label="How to read the map">
        <li>
          <span className="astra-map-legend__swatch astra-map-legend__swatch--focus" aria-hidden="true" /> This product
        </li>
        <li>
          <span className="astra-map-legend__swatch" aria-hidden="true" /> Catalogue product — click to open
        </li>
        <li>
          <span className="astra-map-legend__swatch astra-map-legend__swatch--external" aria-hidden="true" /> External
          substance
        </li>
        <li>
          <span className="astra-map-legend__swatch astra-map-legend__swatch--single" aria-hidden="true" /> Single
          source
        </li>
        <li>
          <span className="astra-map-legend__swatch astra-map-legend__swatch--none" aria-hidden="true" /> No supplier
        </li>
      </ul>
    </div>
  );
}

function MapNode({ node, width, height }: { node: PlacedNode; width: number; height: number }) {
  const body = (
    <>
      <title>{`${node.label} — ${node.detail}`}</title>
      <rect
        x={node.x}
        y={node.y}
        width={width}
        height={height}
        rx={8}
        className={cx(
          'astra-map__node',
          `astra-map__node--${node.kind}`,
          node.risk && node.risk !== 'covered' && `astra-map__node--risk-${node.risk}`,
        )}
      />
      <text x={node.x + 12} y={node.y + 19} className="astra-map__label">
        {truncate(node.label, 25)}
      </text>
      <text x={node.x + 12} y={node.y + 35} className="astra-map__detail">
        {truncate(node.detail, 30)}
      </text>
    </>
  );
  // Plain <a>: inside <svg> React creates an SVG anchor, which next/link can't render.
  return node.href ? (
    <a href={node.href} className="astra-map__link">
      {body}
    </a>
  ) : (
    <g>{body}</g>
  );
}
