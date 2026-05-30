// Pure, stateless wrapper around shared-utils' deduction engine.
// Exposes the interface the FPV's render/HUD layers consume — a single result object with
// possible-set + per-node weights + round number, or null on invariant violation.

import {
  buildDetectivesByTurn,
  computePossiblePositions,
  GAME_GRAPH,
  type PossibleState,
  type Move,
  type Player,
} from '@yard/shared-utils';

export interface DeductionResult {
  /** Possible Mr. X positions (set of node IDs). Always non-empty when valid. */
  possible: Set<number>;
  /** Probability weight per node, normalized to sum to 1. */
  weights: Map<number, number>;
  /** Round number this deduction represents (number of culprit moves). */
  round: number;
}

/**
 * Compute Mr. X's possible positions from the full move log + initial player state.
 * Returns null on invariant violation (revealed node not in possible set, empty possible
 * set). Callers should render the null case as "deduction unknown" rather than crash.
 */
export function runDeduction(moves: Move[], players: Player[]): DeductionResult | null {
  const culpritMoves = moves.filter((m) => m.role === 'culprit');
  const detectiveStarts = new Set(
    players.filter((p) => p.role !== 'culprit').map((p) => p.position)
  );
  const detectivesByTurn = buildDetectivesByTurn(moves, players);

  let state: PossibleState;
  try {
    state = computePossiblePositions(culpritMoves, GAME_GRAPH, detectivesByTurn, detectiveStarts);
  } catch {
    return null;
  }

  return {
    possible: state.possible,
    weights: state.weights,
    round: culpritMoves.length,
  };
}

/**
 * Hover preview: given the current possible-Mr.X set, what would the set look like if a
 * detective were to move to `targetNodeId` right now? The detective now occupies the node,
 * pruning it from possible positions.
 *
 * This is a simplified before-move snapshot; it does not simulate the culprit's response.
 * Wire to M3 paper-map hover.
 */
export function previewAfterDetectiveMove(
  currentPossible: Set<number>,
  targetNodeId: number
): Set<number> {
  if (!currentPossible.has(targetNodeId)) return currentPossible;
  const next = new Set(currentPossible);
  next.delete(targetNodeId);
  return next;
}

/** Max weight in the map (for normalizing heatmap intensity to 0..1). */
export function maxWeight(weights: Map<number, number>): number {
  let max = 0;
  for (const w of weights.values()) {
    if (w > max) max = w;
  }
  return max;
}
