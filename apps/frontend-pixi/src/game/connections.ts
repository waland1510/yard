import { mapData } from '@yard/shared-utils';
import { compassFromDelta, type Direction, type TransportKind } from '../core/map-data';

export type { TransportKind };

export interface Connection {
  kind: TransportKind;
  targetNodeId: number;
  /** Cardinal direction the destination lies in (used for vehicle placement). */
  direction: Direction;
  /** Slot index within (kind, direction) — 0 = curbside, 1 = behind, 2 = further behind. */
  slotIndex: number;
}

const NODE_BY_ID = new Map(mapData.nodes.filter((n) => n.id > 0).map((n) => [n.id, n]));

export function getNode(nodeId: number) {
  return NODE_BY_ID.get(nodeId);
}

export function isValidNode(nodeId: number): boolean {
  return NODE_BY_ID.has(nodeId);
}

/**
 * Returns ALL connections from a node, distributed across only the compass directions
 * that the actual map graph uses from this node.
 *
 * - "Active" directions are those with ≥1 natural connection (from compassFromDelta).
 * - Connections cap at TARGET_PER_DIRECTION per active direction; overflow spills to the
 *   least-loaded active direction. This keeps hub nodes visually spread without forcing
 *   the FPV to fake a 4-way intersection at a stop on a single road.
 * - Slot indices are assigned per direction so multiple vehicles can be parked along the
 *   same road without colliding.
 *
 * If `includeRiver` is true (caller is Mr. X), river connections are also included and
 * surface as ferry vehicles. Detectives skip them — they can't use the river anyway.
 */
const TARGET_PER_DIRECTION = 2;

export function getConnections(nodeId: number, includeRiver = false): Connection[] {
  const node = NODE_BY_ID.get(nodeId);
  if (!node) return [];

  const raw: Array<{ kind: TransportKind; targetNodeId: number; direction: Direction }> = [];

  for (const target of node.taxi ?? []) {
    const t = NODE_BY_ID.get(target);
    if (!t) continue;
    raw.push({ kind: 'taxi', targetNodeId: target, direction: compassFromDelta(t.x - node.x, t.y - node.y) });
  }
  for (const target of node.bus ?? []) {
    const t = NODE_BY_ID.get(target);
    if (!t) continue;
    raw.push({ kind: 'bus', targetNodeId: target, direction: compassFromDelta(t.x - node.x, t.y - node.y) });
  }
  for (const target of node.underground ?? []) {
    const t = NODE_BY_ID.get(target);
    if (!t) continue;
    raw.push({ kind: 'underground', targetNodeId: target, direction: compassFromDelta(t.x - node.x, t.y - node.y) });
  }
  if (includeRiver) {
    for (const target of node.river ?? []) {
      const t = NODE_BY_ID.get(target);
      if (!t) continue;
      raw.push({ kind: 'river', targetNodeId: target, direction: compassFromDelta(t.x - node.x, t.y - node.y) });
    }
  }

  if (raw.length === 0) return [];

  // Split road from river so we can rebalance road independently while river stays in
  // its natural compass direction (so the water visually appears in the right place).
  const riverConns = raw.filter((r) => r.kind === 'river');
  const roadConns = raw.filter((r) => r.kind !== 'river');

  const byDir: Record<Direction, Array<{ kind: TransportKind; targetNodeId: number; direction: Direction }>> = {
    north: [],
    east: [],
    south: [],
    west: [],
  };
  for (const r of roadConns) byDir[r.direction].push(r);

  // Active directions for ROAD = directions where road connections naturally appear.
  // River directions are tracked separately and never participate in rebalancing.
  const riverDirSet = new Set(riverConns.map((r) => r.direction));
  const naturalRoadDirs = Array.from(new Set(roadConns.map((r) => r.direction)));
  // The rebalance target set is road-active directions MINUS river directions, so road
  // vehicles don't end up on a water-only exit.
  const roadActiveDirections = naturalRoadDirs.filter((d) => !riverDirSet.has(d));
  // If a road direction collides with a river direction, move those road connections to
  // a sibling road direction before rebalancing.
  for (const dir of naturalRoadDirs) {
    if (!riverDirSet.has(dir)) continue;
    const moved = byDir[dir].splice(0);
    const sibling =
      roadActiveDirections.reduce<Direction | null>((min, d) =>
        min === null || byDir[d].length < byDir[min].length ? d : min, null) ?? dir;
    for (const m of moved) byDir[sibling].push({ ...m, direction: sibling });
  }

  // Rebalance road connections: cap each road direction at TARGET_PER_DIRECTION.
  let moved = true;
  while (moved) {
    moved = false;
    for (const dir of roadActiveDirections) {
      while (byDir[dir].length > TARGET_PER_DIRECTION) {
        const target = roadActiveDirections.reduce((min, d) =>
          byDir[d].length < byDir[min].length ? d : min
        );
        if (target === dir || byDir[target].length >= TARGET_PER_DIRECTION) break;
        const item = byDir[dir].pop();
        if (!item) break;
        byDir[target].push({ ...item, direction: target });
        moved = true;
      }
    }
  }

  // Assign slot indices per direction, road first then river so the ferry's slot index
  // starts at 0 (it lives on water, not curbside, so its slotIndex doesn't really matter).
  const out: Connection[] = [];
  const allDirs = Array.from(new Set([...roadActiveDirections, ...riverDirSet]));
  for (const dir of allDirs) {
    const roadInDir = byDir[dir];
    roadInDir.forEach((c, idx) => out.push({ ...c, slotIndex: idx }));
  }
  for (const r of riverConns) out.push({ ...r, slotIndex: 0 });
  return out;
}

/** Compass directions where this node has a river edge. Used by the intersection
 *  builder to draw water instead of road in those directions. */
export function getRiverDirections(nodeId: number): Set<Direction> {
  const node = NODE_BY_ID.get(nodeId);
  if (!node || !node.river || node.river.length === 0) return new Set();
  const out = new Set<Direction>();
  for (const target of node.river) {
    const t = NODE_BY_ID.get(target);
    if (!t) continue;
    out.add(compassFromDelta(t.x - node.x, t.y - node.y));
  }
  return out;
}

/** Returns the set of compass directions used by a node's outgoing connections. */
export function getActiveDirections(nodeId: number, includeRiver = false): Set<Direction> {
  const conns = getConnections(nodeId, includeRiver);
  return new Set(conns.map((c) => c.direction));
}

/** Pick a starting node that has all three transport types available — for the prototype. */
export function pickStartingNode(): number {
  for (const n of mapData.nodes) {
    if (n.id <= 0) continue;
    if ((n.taxi?.length ?? 0) > 0 && (n.bus?.length ?? 0) > 0 && (n.underground?.length ?? 0) > 0) {
      return n.id;
    }
  }
  return 1;
}
