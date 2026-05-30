// Real London lat/lng for every game node. Named landmark nodes use precise
// hand-picked coordinates so e.g. node 13 sits at the real Baker Street. Every
// other node is projected linearly from its (x, y) on the original Scotland Yard
// board into a central-London bounding box, so the spatial relationships
// between nodes (neighbors stay neighbors, dead-ends stay at the edges) are
// preserved on the real map. With 217 nodes, the projection gives every one a
// unique location without collisions.

import { mapData } from '@yard/shared-utils';

export interface LondonCoord {
  lat: number;
  lng: number;
}

/** Central anchor — Trafalgar Square. */
export const SCENE_ANCHOR = { lat: 51.508, lng: -0.1281 };

/** Hand-picked precise coords for named landmark nodes. The projection below is
 *  overridden by these so familiar stations sit on their real-world locations. */
const NAMED_COORDS: Record<number, LondonCoord> = {
  1: { lat: 51.5313, lng: -0.1571 },   // Regent's Park
  3: { lat: 51.5225, lng: -0.1631 },   // Marylebone
  13: { lat: 51.5226, lng: -0.1571 },  // Baker Street
  46: { lat: 51.5308, lng: -0.1238 },  // King's Cross
  67: { lat: 51.5152, lng: -0.1418 },  // Oxford Circus
  79: { lat: 51.5101, lng: -0.134 },   // Piccadilly Circus
  89: { lat: 51.5113, lng: -0.1281 },  // Leicester Square
  111: { lat: 51.5252, lng: -0.0335 }, // Mile End
  128: { lat: 51.5093, lng: -0.0764 }, // Tower Hill
  140: { lat: 51.5138, lng: -0.0984 }, // St. Paul's
  153: { lat: 51.5133, lng: -0.089 },  // Bank
  159: { lat: 51.5178, lng: -0.0817 }, // Liverpool Street
  165: { lat: 51.5031, lng: -0.1132 }, // Waterloo
  185: { lat: 51.5142, lng: -0.1494 }, // Bond Street
  199: { lat: 51.5174, lng: -0.1199 }, // Holborn
};

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

// Build the lookup table once. Named overrides win over projection.
const COORDS: Record<number, LondonCoord> = {};
for (const node of mapData.nodes) {
  if (node.id === 0) continue;
  COORDS[node.id] = NAMED_COORDS[node.id] ?? projectXY(node.x, node.y);
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
