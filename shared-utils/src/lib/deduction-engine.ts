import { mapData, Node } from './grid-map';
import { Move, MoveType, Player } from './shared-utils';

export const VALID_STARTING_NODES: ReadonlyArray<number> = [
  13, 26, 29, 34, 50, 53, 91, 94, 103, 112, 117, 132, 138, 141, 155, 174, 197, 198,
];

const TRANSPORT_TYPES: ReadonlyArray<MoveType> = ['taxi', 'bus', 'underground', 'river'];

// Built once — all callers share this reference
export const GAME_GRAPH: Map<number, Node> = new Map(
  mapData.nodes.filter(n => n.id > 0).map(n => [n.id, n])
);

export function expand(
  possible: Set<number>,
  ticket: MoveType | 'secret',
  graph: Map<number, Node>
): Set<number> {
  const next = new Set<number>();
  const types = ticket === 'secret' ? TRANSPORT_TYPES : [ticket];

  for (const nodeId of possible) {
    const node = graph.get(nodeId);
    if (!node) continue;

    for (const type of types) {
      for (const neighbor of node[type] ?? []) {
        if (neighbor !== nodeId) next.add(neighbor); // no-stay guard
      }
    }
  }

  return next;
}

export function prune(
  possible: Set<number>,
  detectivePositions: Set<number>
): Set<number> {
  if (detectivePositions.size === 0) return possible;
  return new Set([...possible].filter(n => !detectivePositions.has(n)));
}

/**
 * Reconstructs detective positions at the end of each culprit turn from the full move log.
 * Key: culprit turn index (0-based). Value: detective positions after all detectives moved that round.
 */
export function buildDetectivesByTurn(
  allMoves: Move[],
  initialPlayers: Player[]
): Map<number, Set<number>> {
  const result = new Map<number, Set<number>>();
  const positions = new Map<string, number>(
    initialPlayers
      .filter(p => p.role !== 'culprit')
      .map(p => [p.role, p.position])
  );

  let culpritTurn = -1;

  for (const move of allMoves) {
    if (move.role === 'culprit') {
      culpritTurn++;
    } else if (move.role && move.position != null) {
      positions.set(move.role, move.position);
    }

    if (culpritTurn >= 0) {
      result.set(culpritTurn, new Set(positions.values()));
    }
  }

  return result;
}

export interface PossibleState {
  possible: Set<number>;
  weights: Map<number, number>;
}

/**
 * Recomputes Mr. X's possible positions from scratch using the full culprit move history.
 * Pure function — deterministic, stateless, fully replayable.
 *
 * @param culpritMoves      - moves where role === 'culprit', in order
 * @param graph             - node adjacency map (use GAME_GRAPH)
 * @param detectivesByTurn  - from buildDetectivesByTurn()
 * @param detectiveStartPositions - starting positions of detectives (pruned from initial set)
 */
export function computePossiblePositions(
  culpritMoves: Move[],
  graph: Map<number, Node>,
  detectivesByTurn: Map<number, Set<number>>,
  detectiveStartPositions: Set<number>
): PossibleState {
  let possible = new Set(
    VALID_STARTING_NODES.filter(n => !detectiveStartPositions.has(n))
  );
  let weights = new Map<number, number>(
    [...possible].map(n => [n, 1 / possible.size])
  );

  for (let turn = 0; turn < culpritMoves.length; turn++) {
    const move = culpritMoves[turn];
    const detectives = detectivesByTurn.get(turn) ?? new Set<number>();

    if (move.double) {
      // First half of double move
      const ticket1 = move.secret ? 'secret' : move.type;
      possible = expand(possible, ticket1, graph);
      weights = expandWeights(weights, ticket1, graph);
      possible = prune(possible, detectives);
      weights = pruneWeights(weights, detectives);

      // Second half — next move entry
      const move2 = culpritMoves[turn + 1];
      if (move2) {
        turn++;
        const ticket2 = move2.secret ? 'secret' : move2.type;
        possible = expand(possible, ticket2, graph);
        weights = expandWeights(weights, ticket2, graph);
        possible = prune(possible, detectives);
        weights = pruneWeights(weights, detectives);
      }
    } else {
      const ticket = move.secret ? 'secret' : move.type;
      possible = expand(possible, ticket, graph);
      weights = expandWeights(weights, ticket, graph);
      possible = prune(possible, detectives);
      weights = pruneWeights(weights, detectives);
    }

    // Reveal: hard reset to single known position
    if (isRevealTurn(turn + 1) && move.position != null) {
      if (!possible.has(move.position)) {
        throw new Error(
          `Deduction engine invariant violated: revealed node ${move.position} not in possible set at turn ${turn + 1}. Possible: [${[...possible].join(', ')}]`
        );
      }
      possible = new Set([move.position]);
      weights = new Map([[move.position, 1]]);
    }

    if (possible.size === 0) {
      throw new Error(`Deduction engine invariant violated: empty possible set at turn ${turn + 1}`);
    }
  }

  return { possible, weights };
}

// Reveal turns are 1-indexed culprit move counts (after move 3, 8, 13, 18, 24)
function isRevealTurn(culpritMoveNumber: number): boolean {
  return [3, 8, 13, 18, 24].includes(culpritMoveNumber);
}

function expandWeights(
  weights: Map<number, number>,
  ticket: MoveType | 'secret',
  graph: Map<number, Node>
): Map<number, number> {
  const next = new Map<number, number>();
  const types = ticket === 'secret' ? TRANSPORT_TYPES : [ticket];

  for (const [nodeId, w] of weights) {
    const node = graph.get(nodeId);
    if (!node) continue;

    const neighbors: number[] = [];
    for (const type of types) {
      for (const n of node[type] ?? []) {
        if (n !== nodeId) neighbors.push(n);
      }
    }

    if (neighbors.length === 0) continue;
    const share = w / neighbors.length;
    for (const n of neighbors) {
      next.set(n, (next.get(n) ?? 0) + share);
    }
  }

  return normalize(next);
}

function pruneWeights(
  weights: Map<number, number>,
  detectivePositions: Set<number>
): Map<number, number> {
  if (detectivePositions.size === 0) return weights;
  const pruned = new Map<number, number>(
    [...weights].filter(([n]) => !detectivePositions.has(n))
  );
  return normalize(pruned);
}

export function normalize(weights: Map<number, number>): Map<number, number> {
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return weights;
  return new Map([...weights].map(([k, v]) => [k, v / total]));
}
