// The one place every other module imports static map facts from.
// Pure: no React, no Three.js, no I/O.

import { mapData, type Node } from '@yard/shared-utils';

export { mapData };
export type { Node };

export type Direction = 'north' | 'south' | 'east' | 'west';

export const DIRECTION_ORDER: readonly Direction[] = ['north', 'east', 'south', 'west'];

export type TransportKind = 'taxi' | 'bus' | 'underground' | 'river';

export const SHOW_CULPRIT_AT_MOVES = [3, 8, 13, 18, 24] as const;
const REVEAL_SET: ReadonlySet<number> = new Set(SHOW_CULPRIT_AT_MOVES);

export function isRevealRound(culpritMoveNumber: number): boolean {
  return REVEAL_SET.has(culpritMoveNumber);
}

const NODE_BY_ID = new Map<number, Node>(
  mapData.nodes.filter((n) => n.id > 0).map((n) => [n.id, n])
);

export function getNode(nodeId: number): Node | undefined {
  return NODE_BY_ID.get(nodeId);
}

export function isValidNode(nodeId: number): boolean {
  return NODE_BY_ID.has(nodeId);
}

export function allNodes(): Node[] {
  return Array.from(NODE_BY_ID.values());
}

export function neighborsOf(nodeId: number, kind: TransportKind): number[] {
  const node = NODE_BY_ID.get(nodeId);
  if (!node) return [];
  return (node[kind] ?? []).slice();
}

export function allNeighbors(nodeId: number): Record<TransportKind, number[]> {
  const node = NODE_BY_ID.get(nodeId);
  return {
    taxi: node?.taxi?.slice() ?? [],
    bus: node?.bus?.slice() ?? [],
    underground: node?.underground?.slice() ?? [],
    river: node?.river?.slice() ?? [],
  };
}

// Direction inference from a (current → target) delta. SVG-style Y axis (positive = south).
export function compassFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'east' : 'west';
  }
  return dy >= 0 ? 'south' : 'north';
}

// Role color palette — single source for character tokens, UI accents, paper-map dots.
export interface RolePalette {
  detective1: string;
  detective2: string;
  detective3: string;
  detective4: string;
  detective5: string;
  culprit: string;
}

export const ROLE_PALETTE: RolePalette = {
  detective1: '#3b82f6',
  detective2: '#f59e0b',
  detective3: '#10b981',
  detective4: '#ec4899',
  detective5: '#8b5cf6',
  culprit: '#111827',
};

// Named landmarks for ~15 recognizable London nodes. Everything else falls back to "Junction #N".
export const LANDMARK_NAMES: Record<number, string> = {
  1: "Regent's Park",
  3: 'Marylebone',
  13: 'Baker Street',
  46: "King's Cross",
  67: 'Oxford Circus',
  79: 'Piccadilly Circus',
  89: 'Leicester Square',
  111: 'Mile End',
  128: 'Tower Hill',
  140: "St. Paul's",
  153: 'Bank',
  159: 'Liverpool Street',
  165: 'Waterloo',
  185: 'Bond Street',
  199: 'Holborn',
};

export function nodeDisplayName(nodeId: number): string {
  return LANDMARK_NAMES[nodeId] ?? `Junction #${nodeId}`;
}

/** Pick a starting node that has all three transport types available — for the prototype + tests. */
export function pickDemoStartingNode(): number {
  for (const n of NODE_BY_ID.values()) {
    if ((n.taxi?.length ?? 0) > 0 && (n.bus?.length ?? 0) > 0 && (n.underground?.length ?? 0) > 0) {
      return n.id;
    }
  }
  return 1;
}
