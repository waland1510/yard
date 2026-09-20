import {
  GAME_GRAPH,
  Move,
  Player,
  Role,
  VALID_STARTING_NODES,
  buildDetectivesByTurn,
  computePossiblePositions,
  expand,
} from '@yard/shared-utils';

function culpritMove(type: Move['type'], position: number): Move {
  return { role: Role.culprit, type, position, secret: false, double: false };
}

function detectiveAt(role: Player['role'], position: number): Player {
  return { id: 2, role, position, taxiTickets: 10, busTickets: 8, undergroundTickets: 4 };
}

/** A start node with at least one taxi exit adjacent to some other node we can park a
 *  detective on, and at least one taxi exit that is far from it. */
function findScenario() {
  for (const start of VALID_STARTING_NODES) {
    const exits = GAME_GRAPH.get(start)?.taxi ?? [];
    if (exits.length < 3) continue;
    for (const near of exits) {
      const guard = (GAME_GRAPH.get(near)?.taxi ?? []).find(g => g !== start && !exits.includes(g));
      if (guard == null) continue;
      const guardReach = new Set([guard, ...(GAME_GRAPH.get(guard)?.taxi ?? []), ...(GAME_GRAPH.get(guard)?.bus ?? [])]);
      const far = exits.find(e => e !== near && !guardReach.has(e) && !(GAME_GRAPH.get(e)?.taxi ?? []).some(x => guardReach.has(x)));
      if (far != null) return { start, near, far, guard };
    }
  }
  throw new Error('no scenario found');
}

describe('deduction engine flee prior', () => {
  const { start, near, far, guard } = findScenario();
  const players = [detectiveAt(Role.detective1, guard)];
  const starts = new Set([guard]);
  const moves = [culpritMove('taxi', near)];

  it('fleePrior_exitNextToDetective_getsLessMassThanDistantExit', () => {
    const { weights } = computePossiblePositions(moves, GAME_GRAPH, buildDetectivesByTurn(moves, players), starts);
    const massFrom = (node: number) => weights.get(node) ?? 0;
    expect(massFrom(near)).toBeGreaterThan(0);
    expect(massFrom(near)).toBeLessThan(massFrom(far));
  });

  it('fleePrior_weightsStillSumToOne', () => {
    const { weights } = computePossiblePositions(moves, GAME_GRAPH, buildDetectivesByTurn(moves, players), starts);
    const total = [...weights.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('fleePrior_possibleSetUnchangedByPrior', () => {
    const { possible } = computePossiblePositions(moves, GAME_GRAPH, buildDetectivesByTurn(moves, players), starts);
    const expected = new Set(
      [...expand(new Set(VALID_STARTING_NODES.filter(n => n !== guard)), 'taxi', GAME_GRAPH)].filter(n => n !== guard)
    );
    expect(possible).toEqual(expected);
  });

  it('fleePrior_everyPossibleNodeKeepsPositiveWeight', () => {
    const { possible, weights } = computePossiblePositions(moves, GAME_GRAPH, buildDetectivesByTurn(moves, players), starts);
    for (const node of possible) expect(weights.get(node) ?? 0).toBeGreaterThan(0);
    expect(weights.size).toBe(possible.size);
  });

  it('fleePrior_noDetectives_staysUniformPerExit', () => {
    const { weights } = computePossiblePositions(moves, GAME_GRAPH, new Map(), new Set());
    const exits = GAME_GRAPH.get(start)?.taxi ?? [];
    const singleParent = exits.filter(e => {
      let parents = 0;
      for (const s of VALID_STARTING_NODES) if (GAME_GRAPH.get(s)?.taxi?.includes(e)) parents++;
      return parents === 1;
    });
    if (singleParent.length >= 2) {
      expect(weights.get(singleParent[0])).toBeCloseTo(weights.get(singleParent[1]) ?? -1, 9);
    }
  });
});
