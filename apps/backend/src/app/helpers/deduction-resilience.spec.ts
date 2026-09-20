import { GAME_GRAPH, GameState, Move, Player, Role, VALID_STARTING_NODES } from '@yard/shared-utils';
import { deductionFor } from './ai-decision-arbiter';

function walk(start: number, steps: number): Move[] {
  const moves: Move[] = [];
  let cur = start;
  const visited = new Set<number>([start]);
  for (let i = 0; i < steps; i++) {
    const node = GAME_GRAPH.get(cur);
    const next = node?.taxi?.find(n => !visited.has(n)) ?? node?.taxi?.[0];
    if (next == null) break;
    visited.add(next);
    moves.push({ role: Role.culprit, type: 'taxi', position: next, secret: false, double: false });
    cur = next;
  }
  return moves;
}

function gameWith(moves: Move[]): GameState {
  const players: Player[] = [
    { id: 1, role: Role.culprit, position: 1, taxiTickets: 4, busTickets: 3, undergroundTickets: 3 },
    { id: 2, role: Role.detective1, position: 100, taxiTickets: 10, busTickets: 8, undergroundTickets: 4 },
  ];
  return {
    channel: 'test',
    players,
    currentTurn: Role.detective1,
    moves,
    isDoubleMove: false,
    status: 'active',
  };
}

describe('deduction resilience', () => {
  it('deductionFor_chronologicalLog_narrowsToRevealedNode', () => {
    const moves = walk(VALID_STARTING_NODES[0], 3);
    expect(moves).toHaveLength(3);

    const { possible } = deductionFor(gameWith(moves));

    expect([...possible]).toEqual([moves[2].position]);
  });

  it('deductionFor_corruptLogViolatingInvariant_fallsBackToUniformPrior', () => {
    // A reveal at culprit move 3 that is unreachable from the prior two moves — the exact
    // shape an unordered SELECT produces.
    const moves: Move[] = [
      { role: Role.culprit, type: 'taxi', position: 4, secret: false, double: false },
      { role: Role.culprit, type: 'taxi', position: 3, secret: false, double: false },
      { role: Role.culprit, type: 'taxi', position: 1, secret: false, double: false },
    ];

    const { possible, weights } = deductionFor(gameWith(moves));

    expect(possible.size).toBe(VALID_STARTING_NODES.length);
    expect([...weights.values()].every(w => w > 0)).toBe(true);
  });

  it('deductionFor_emptyLog_returnsUniformPriorOverStartingNodes', () => {
    const { possible, weights } = deductionFor(gameWith([]));

    expect(possible.size).toBe(VALID_STARTING_NODES.length);
    expect(weights.size).toBe(VALID_STARTING_NODES.length);
  });
});
