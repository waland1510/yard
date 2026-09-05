// Board-style transport routes over the Google Maps base: thick opaque strokes per
// transport, thin-over-thick draw order, dashed tube/river, dark casing under solid
// lines. Mirrors the printed Scotland Yard board that the legacy SVG frontend drew.

import { mapData } from '@yard/shared-utils';
import type { TransportKind } from '../game/connections';
import { ALL_EDGES, coordsForNode, type LondonCoord } from '../game/london-coords';

export const KIND_COLOR: Record<TransportKind, string> = {
  taxi: '#f6c945',
  bus: '#2e9b4f',
  underground: '#d63a3a',
  river: '#3a86c7',
};

const CASING_COLOR = '#23302a';
const REFERENCE_ZOOM = 14;

interface EdgeStyle {
  weight: number;
  /** Extra stroke width (px) of the dark outline under a solid line. 0 = none. */
  casing: number;
  /** Dash pattern in px at the reference zoom. Undefined = solid. */
  dash?: { on: number; off: number };
}

const BOARD_STYLE: Record<TransportKind, EdgeStyle> = {
  taxi: { weight: 4, casing: 2 },
  bus: { weight: 7, casing: 2 },
  underground: { weight: 9, casing: 0, dash: { on: 9, off: 9 } },
  river: { weight: 7, casing: 0, dash: { on: 22, off: 12 } },
};

const KIND_Z: Record<TransportKind, number> = {
  river: 0,
  underground: 1,
  bus: 2,
  taxi: 3,
};

export interface EdgePolylineOptions {
  weight: number;
  opacity: number;
  zIndex: number;
  /** Colour of a wider stroke drawn under the line; omit for no casing. */
  casingColor?: string;
  casingExtra?: number;
  dash?: { on: number; off: number };
}

function dashedIcons(
  color: string,
  weight: number,
  opacity: number,
  dash: { on: number; off: number }
): google.maps.IconSequence[] {
  return [
    {
      icon: {
        path: 'M 0,-1 0,1',
        strokeColor: color,
        strokeOpacity: opacity,
        strokeWeight: weight,
        scale: dash.on / 2,
      },
      offset: '0',
      repeat: `${dash.on + dash.off}px`,
    },
  ];
}

function strokeOptions(
  kind: TransportKind,
  weight: number,
  opacity: number,
  dash?: { on: number; off: number }
): google.maps.PolylineOptions {
  if (dash) {
    return {
      strokeOpacity: 0,
      icons: dashedIcons(KIND_COLOR[kind], weight, opacity, dash),
    };
  }
  return { strokeColor: KIND_COLOR[kind], strokeOpacity: opacity, strokeWeight: weight, icons: [] };
}

/** Draws one edge as a stack of polylines (casing first, then the coloured stroke). */
export function drawEdge(
  map: google.maps.Map,
  kind: TransportKind,
  path: LondonCoord[],
  { weight, opacity, zIndex, casingColor, casingExtra = 3, dash }: EdgePolylineOptions
): google.maps.Polyline[] {
  const out: google.maps.Polyline[] = [];
  if (casingColor && !dash) {
    out.push(
      new google.maps.Polyline({
        map,
        path,
        clickable: false,
        zIndex: zIndex - 1,
        strokeColor: casingColor,
        strokeOpacity: opacity,
        strokeWeight: weight + casingExtra,
      })
    );
  }
  out.push(
    new google.maps.Polyline({
      map,
      path,
      clickable: false,
      zIndex,
      ...strokeOptions(kind, weight, opacity, dash),
    })
  );
  return out;
}

/** Board dash pattern for a kind, or undefined for solid transports. */
export function boardDash(kind: TransportKind) {
  return BOARD_STYLE[kind].dash;
}

function scaleForZoom(zoom: number): number {
  return Math.min(1.5, Math.max(0.45, Math.pow(1.4, zoom - REFERENCE_ZOOM)));
}

interface BoardEdge {
  kind: TransportKind;
  casing: google.maps.Polyline | null;
  stroke: google.maps.Polyline;
}

/** Draws every graph edge as a board-style route and keeps stroke widths scaled to
 *  the map zoom so the network stays legible both zoomed-out and street-level.
 *  Returns a dispose function. */
export function mountBoardEdges(map: google.maps.Map): () => void {
  const edges: BoardEdge[] = [];
  const scale = scaleForZoom(map.getZoom() ?? REFERENCE_ZOOM);

  for (const edge of ALL_EDGES) {
    const style = BOARD_STYLE[edge.kind];
    const path = [coordsForNode(edge.a), coordsForNode(edge.b)];
    const zIndex = KIND_Z[edge.kind] * 2 + 1;
    const lines = drawEdge(map, edge.kind, path, {
      weight: style.weight * scale,
      opacity: 0.92,
      zIndex,
      casingColor: style.casing > 0 ? CASING_COLOR : undefined,
      casingExtra: style.casing,
      dash: scaledDash(style.dash, scale),
    });
    const stroke = lines[lines.length - 1];
    edges.push({ kind: edge.kind, casing: lines.length > 1 ? lines[0] : null, stroke });
  }

  const zoomListener = map.addListener('zoom_changed', () => {
    const s = scaleForZoom(map.getZoom() ?? REFERENCE_ZOOM);
    for (const { kind, casing, stroke } of edges) {
      const style = BOARD_STYLE[kind];
      const weight = style.weight * s;
      casing?.setOptions({ strokeWeight: weight + style.casing });
      stroke.setOptions(strokeOptions(kind, weight, 0.92, scaledDash(style.dash, s)));
    }
  });

  return () => {
    zoomListener.remove();
    for (const { casing, stroke } of edges) {
      casing?.setMap(null);
      stroke.setMap(null);
    }
    edges.length = 0;
  };
}

function scaledDash(dash: { on: number; off: number } | undefined, scale: number) {
  if (!dash) return undefined;
  return { on: dash.on * scale, off: dash.off * scale };
}

const NODE_TIER = new Map<number, TransportKind | null>(
  mapData.nodes
    .filter((n) => n.id > 0)
    .map((n) => [
      n.id,
      n.underground?.length ? 'underground' : n.bus?.length ? 'bus' : null,
    ])
);

/** Ring colour for a base node marker: red for tube stations, green for bus stops,
 *  dark for taxi-only — as on the printed board. */
export function nodeRingColor(nodeId: number): string {
  const tier = NODE_TIER.get(nodeId);
  return tier ? KIND_COLOR[tier] : '#222';
}
