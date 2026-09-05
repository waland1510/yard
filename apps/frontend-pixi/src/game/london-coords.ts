// Real London lat/lng for every game node, projected linearly from its (x, y) on
// the original Scotland Yard board into a central-London bounding box. Board
// adjacency is preserved exactly (neighbors stay neighbors, dead-ends stay at
// the edges) so the route network reads as cleanly as the printed board.
// Landmark names (Baker Street, Bank, ...) are labels only — pinning those nodes
// to their real stations pulled them 1–8 km off the grid and produced long
// crossing edges.

import { mapData } from '@yard/shared-utils';

export interface LondonCoord {
  lat: number;
  lng: number;
}

/** Central anchor — Trafalgar Square. */
export const SCENE_ANCHOR = { lat: 51.508, lng: -0.1281 };

// Board coord ranges (verified from grid-map.ts):
const X_MIN = 50;
const X_MAX = 1150;
const Y_MIN = 50;
const Y_MAX = 835;

// Central London bounding box, sized to roughly match the board's aspect ratio.
// East-west range ~5km, north-south range ~3km — covers Hyde Park to the City,
// Euston to the Thames.
const LAT_MIN = 51.483;
const LAT_MAX = 51.535;
const LNG_MIN = -0.195;
const LNG_MAX = -0.055;

function projectXY(x: number, y: number): LondonCoord {
  // Y inverts: board y grows downward, lat grows northward
  const nx = (x - X_MIN) / (X_MAX - X_MIN);
  const ny = (y - Y_MIN) / (Y_MAX - Y_MIN);
  return {
    lat: LAT_MAX - ny * (LAT_MAX - LAT_MIN),
    lng: LNG_MIN + nx * (LNG_MAX - LNG_MIN),
  };
}

const COORDS: Record<number, LondonCoord> = {};
for (const node of mapData.nodes) {
  if (node.id === 0) continue;
  COORDS[node.id] = projectXY(node.x, node.y);
}

export function coordsForNode(nodeId: number): LondonCoord {
  return COORDS[nodeId] ?? SCENE_ANCHOR;
}

/** All known node IDs in the graph — used by MapView to render every node. */
export const ALL_NODE_IDS: readonly number[] = mapData.nodes
  .filter((n) => n.id > 0)
  .map((n) => n.id);

/** All edges in the graph, deduped (each pair appears once with the kind that
 *  applies). A node pair connected by both taxi and bus produces two entries. */
export interface GraphEdge {
  a: number;
  b: number;
  kind: 'taxi' | 'bus' | 'underground' | 'river';
}

export const ALL_EDGES: readonly GraphEdge[] = (() => {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  const kinds = ['taxi', 'bus', 'underground', 'river'] as const;
  for (const node of mapData.nodes) {
    if (node.id <= 0) continue;
    for (const kind of kinds) {
      const targets = node[kind];
      if (!targets) continue;
      for (const t of targets) {
        if (t <= 0) continue;
        const lo = Math.min(node.id, t);
        const hi = Math.max(node.id, t);
        const key = `${lo}-${hi}-${kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ a: lo, b: hi, kind });
      }
    }
  }
  return out;
})();
