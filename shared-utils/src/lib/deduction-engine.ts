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

/** How strongly the belief assumes Mr. X steers away from detectives. Indexed by hop
 *  distance from the destination to the nearest detective at the moment he moves; the
 *  last entry applies to every larger distance. Values are relative, so `[0.25, 0.6, 1]`
 *  means an exit beside a detective draws a quarter of the mass a safe exit does. */
export type FleePrior = readonly number[];

export const DEFAULT_FLEE_PRIOR: FleePrior = [0.25, 0.6, 1];

/** A flat prior: every exit equally likely, the behaviour before the flee prior existed. */
export const UNIFORM_PRIOR: FleePrior = [1];

export interface DeductionOptions {
  fleePrior?: FleePrior;
}

/** Hop distance from every node to the nearest detective, one multi-source BFS. */
export function distanceToNearest(
  sources: Set<number>,
  graph: Map<number, Node>
): Map<number, number> {
  const dist = new Map<number, number>();
  if (sources.size === 0) return dist;
  let frontier = [...sources];
  for (const s of frontier) dist.set(s, 0);
  let hops = 0;
  while (frontier.length > 0) {
    hops++;
    const next: number[] = [];
    for (const nodeId of frontier) {
      const node = graph.get(nodeId);
      if (!node) continue;
      for (const type of TRANSPORT_TYPES) {
        for (const n of node[type] ?? []) {
          if (!dist.has(n)) {
            dist.set(n, hops);
            next.push(n);
          }
        }
      }
    }
    frontier = next;
  }
  return dist;
}

function fleeFactor(distance: number | undefined, prior: FleePrior): number {
  if (prior.length === 0) return 1;
  if (distance === undefined) return prior[prior.length - 1];
  return prior[Math.min(distance, prior.length - 1)];
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
  detectiveStartPositions: Set<number>,
  options: DeductionOptions = {}
): PossibleState {
  const fleePrior = options.fleePrior ?? DEFAULT_FLEE_PRIOR;
  let possible = new Set(
    VALID_STARTING_NODES.filter(n => !detectiveStartPositions.has(n))
  );
  let weights = new Map<number, number>(
    [...possible].map(n => [n, 1 / possible.size])
  );

  // Detectives do not move between the two legs of a double, so the second leg is pruned
  // against the same detective positions as the first.
  let pruneAgainst: Set<number> | null = null;

  for (let turn = 0; turn < culpritMoves.length; turn++) {
    const move = culpritMoves[turn];
    const previous = turn > 0 ? culpritMoves[turn - 1] : undefined;
    const isSecondLeg = previous?.double === true;
    const detectives: Set<number> = isSecondLeg && pruneAgainst
      ? pruneAgainst
      : detectivesByTurn.get(turn) ?? new Set<number>();
    pruneAgainst = move.double ? detectives : null;

    const ticket = move.secret ? 'secret' : move.type;
    const threat = distanceToNearest(detectives, graph);
    possible = expand(possible, ticket, graph);
    weights = expandWeights(weights, ticket, graph, threat, fleePrior);
    possible = prune(possible, detectives);
    weights = pruneWeights(weights, detectives);

    // Reveal rounds count every leg of a double as its own move, so the check runs per leg.
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
  graph: Map<number, Node>,
  threat: Map<number, number>,
  fleePrior: FleePrior
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

    // Each exit's share is proportional to how safe it looks to a fleeing Mr. X. A node
    // that will be pruned (a detective stands on it) still gets a share here; pruneWeights
    // removes it and renormalizes, so the remaining exits absorb its mass.
    const factors = neighbors.map(n => fleeFactor(threat.get(n), fleePrior));
    const totalFactor = factors.reduce((a, b) => a + b, 0);
    if (totalFactor === 0) continue;

    neighbors.forEach((n, i) => {
      next.set(n, (next.get(n) ?? 0) + (w * factors[i]) / totalFactor);
    });
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
