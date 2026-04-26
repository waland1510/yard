import {
  GameState,
  Move,
  Player,
  MoveType,
  mapData,
  Node,
  computePossiblePositions,
  buildDetectivesByTurn,
  GAME_GRAPH,
  VALID_STARTING_NODES,
} from '@yard/shared-utils';
import { decideLocalMove } from './local-move-decision';

type NodeConnections = {
  taxi?: number[];
  bus?: number[];
  underground?: number[];
};

function findShortestPath(
  map: Map<number, NodeConnections>,
  player: Player,
  targets: number[],
  maxDepth = Infinity
): number[] | null {
  const visited = new Set<string>();
  const queue: { path: number[]; taxi: number; bus: number; underground: number }[] = [{
    path: [player.position],
    taxi: player.taxiTickets,
    bus: player.busTickets,
    underground: player.undergroundTickets,
  }];

  while (queue.length > 0) {
    const { path, taxi, bus, underground } = queue.shift();
    const current = path[path.length - 1];

    if (targets.includes(current)) return path;
    if (path.length > maxDepth) continue;

    const key = `${current}:${taxi}:${bus}:${underground}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const node = map.get(current);
    if (!node) continue;

    if (taxi > 0 && node.taxi) {
      for (const next of node.taxi) {
        queue.push({ path: [...path, next], taxi: taxi - 1, bus, underground });
      }
    }
    if (bus > 0 && node.bus) {
      for (const next of node.bus) {
        queue.push({ path: [...path, next], taxi, bus: bus - 1, underground });
      }
    }
    if (underground > 0 && node.underground) {
      for (const next of node.underground) {
        queue.push({ path: [...path, next], taxi, bus, underground: underground - 1 });
      }
    }
  }

  return null;
}

function bfsHopDistance(
  map: Map<number, NodeConnections>,
  from: number,
  to: number
): number {
  if (from === to) return 0;
  const visited = new Set<number>();
  const queue: { node: number; hops: number }[] = [{ node: from, hops: 0 }];

  while (queue.length > 0) {
    const { node: current, hops } = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    const connections = map.get(current);
    if (!connections) continue;

    const neighbors = [
      ...(connections.taxi || []),
      ...(connections.bus || []),
      ...(connections.underground || []),
    ];

    for (const next of neighbors) {
      if (next === to) return hops + 1;
      if (!visited.has(next)) queue.push({ node: next, hops: hops + 1 });
    }
  }

  return 999;
}

const _sharedMap = new Map<number, NodeConnections>(
  mapData.nodes.map(node => [node.id, { taxi: node.taxi, bus: node.bus, underground: node.underground }])
);

function getReachableNodes(player: Player): Array<{ type: MoveType; position: number }> {
  const node = GAME_GRAPH.get(player.position);
  if (!node) return [];

  const moves: Array<{ type: MoveType; position: number }> = [];

  if (player.taxiTickets > 0) {
    for (const n of node.taxi ?? []) moves.push({ type: 'taxi', position: n });
  }
  if (player.busTickets > 0) {
    for (const n of node.bus ?? []) moves.push({ type: 'bus', position: n });
  }
  if (player.undergroundTickets > 0) {
    for (const n of node.underground ?? []) moves.push({ type: 'underground', position: n });
  }

  return moves;
}

function pickTransportToNode(player: Player, targetPosition: number): MoveType | null {
  const node = GAME_GRAPH.get(player.position);
  if (!node) return null;

  if (player.taxiTickets > 0 && node.taxi?.includes(targetPosition)) return 'taxi';
  if (player.busTickets > 0 && node.bus?.includes(targetPosition)) return 'bus';
  if (player.undergroundTickets > 0 && node.underground?.includes(targetPosition)) return 'underground';

  return null;
}

function calculateDetectiveMove(gameState: GameState, detective: Player): Move {
  const culpritMoves = gameState.moves.filter(m => m.role === 'culprit');
  const otherDetectives = new Set(
    gameState.players
      .filter(p => p.role !== 'culprit' && p.role !== detective.role)
      .map(p => p.position)
  );

  let targets: number[];
  let weights: Map<number, number> | null = null;

  if (culpritMoves.length === 0) {
    // No culprit moves yet — spread across all valid starting nodes
    targets = [...VALID_STARTING_NODES];
    console.log(`[Detective AI] ${detective.role} deciding: pos=${detective.position}, no culprit moves yet, targeting all ${targets.length} starting nodes`);
  } else {
    const detectiveStartPositions = new Set(
      gameState.players.filter(p => p.role !== 'culprit').map(p => p.position)
    );
    const detectivesByTurn = buildDetectivesByTurn(gameState.moves, gameState.players);
    const { possible, weights: w } = computePossiblePositions(
      culpritMoves, GAME_GRAPH, detectivesByTurn, detectiveStartPositions
    );
    targets = [...possible];
    weights = w;
    const topEntries = [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`[Detective AI] ${detective.role} deciding: pos=${detective.position}, possible=${possible.size}, top5=[${topEntries.map(([n, p]) => `${n}:${p.toFixed(2)}`).join(', ')}]`);
  }

  // Pick the highest-weight target as primary; fall back to closest if no weights
  const sortedTargets = weights
    ? targets.sort((a, b) => (weights.get(b) ?? 0) - (weights.get(a) ?? 0))
    : targets.sort((a, b) => bfsHopDistance(_sharedMap, detective.position, a) - bfsHopDistance(_sharedMap, detective.position, b));

  const path = findShortestPath(_sharedMap, detective, sortedTargets);
  console.log(`[Detective AI] ${detective.role} BFS path: [${path?.join(' → ') ?? 'none'}]`);

  if (path && path.length > 1) {
    const nextPosition = path[1];

    if (!otherDetectives.has(nextPosition)) {
      const type = pickTransportToNode(detective, nextPosition);
      if (type) {
        console.log(`[Detective AI] ${detective.role} → ${nextPosition} (${type}) ✓`);
        return { type, position: nextPosition, secret: false, double: false, role: detective.role };
      }
      console.log(`[Detective AI] ${detective.role} nextPosition=${nextPosition} blocked: no ticket`);
    } else {
      console.log(`[Detective AI] ${detective.role} nextPosition=${nextPosition} blocked: another detective there`);
    }

    const reachable = getReachableNodes(detective).filter(m => !otherDetectives.has(m.position));
    if (reachable.length > 0) {
      const best = reachable.sort((a, b) =>
        bfsHopDistance(_sharedMap, a.position, sortedTargets[0]) -
        bfsHopDistance(_sharedMap, b.position, sortedTargets[0])
      )[0];
      console.log(`[Detective AI] ${detective.role} → ${best.position} (${best.type}) fallback`);
      return { type: best.type, position: best.position, secret: false, double: false, role: detective.role };
    }
  }

  console.log(`[Detective AI] ${detective.role} → decideLocalMove (no path found)`);
  return decideLocalMove(gameState, detective);
}

/**
 * Culprit AI: maximize distance from all detectives, prefer high-connectivity nodes.
 */
function calculateCulpritMove(gameState: GameState, culprit: Player): Move {
  const detectives = gameState.players.filter(p => p.role !== 'culprit');
  const reachable = getReachableNodes(culprit);

  if (reachable.length === 0) {
    return decideLocalMove(gameState, culprit);
  }

  const scored = reachable.map(move => {
    const minDetDist = Math.min(
      ...detectives.map(d => bfsHopDistance(_sharedMap, move.position, d.position))
    );
    const node = GAME_GRAPH.get(move.position);
    const exits = (node?.taxi?.length ?? 0) + (node?.bus?.length ?? 0) + (node?.underground?.length ?? 0);

    return { move, score: minDetDist * 10 + exits };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].move;

  const useSecret = shouldUseSecret(culprit, best.position, detectives);
  const useDouble = shouldUseDouble(culprit, best.position, detectives);

  console.log(`[Culprit AI] → ${best.position} (${best.type}), secret=${useSecret}, double=${useDouble}`);
  return { type: best.type, position: best.position, secret: useSecret, double: useDouble, role: culprit.role };
}

function shouldUseSecret(culprit: Player, targetPosition: number, detectives: Player[]): boolean {
  if (!culprit.secretTickets || culprit.secretTickets <= 0) return false;
  const minDist = Math.min(...detectives.map(d => bfsHopDistance(_sharedMap, targetPosition, d.position)));
  return minDist <= 2;
}

function shouldUseDouble(culprit: Player, targetPosition: number, detectives: Player[]): boolean {
  if (!culprit.doubleTickets || culprit.doubleTickets <= 0) return false;
  const minDist = Math.min(...detectives.map(d => bfsHopDistance(_sharedMap, targetPosition, d.position)));
  return minDist <= 2;
}

export class AIPlayerService {
  async calculateMove(gameState: GameState, player: Player): Promise<Move> {
    try {
      if (player.role === 'culprit') {
        return calculateCulpritMove(gameState, player);
      } else {
        return calculateDetectiveMove(gameState, player);
      }
    } catch (error) {
      console.error(`[AI Error] ${player.role}:`, (error as Error).message);
      return decideLocalMove(gameState, player);
    }
  }
}
