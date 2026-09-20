import {
  GAME_GRAPH,
  Move,
  Player,
  Role,
  buildDetectivesByTurn,
  computePossiblePositions,
} from '@yard/shared-utils';

const detectives: Player[] = [
  { id: 2, role: Role.detective1, position: 100, taxiTickets: 10, busTickets: 8, undergroundTickets: 4 },
];
const detectiveStarts = new Set([100]);

function culpritWalk(start: number, count: number, flags: Array<Partial<Move>> = []): Move[] {
  const moves: Move[] = [];
  let current = start;
  const seen = new Set([start]);
  for (let i = 0; i < count; i++) {
    const node = GAME_GRAPH.get(current);
    const next = node?.taxi?.find(n => !seen.has(n)) ?? node?.taxi?.[0];
    if (next == null) throw new Error(`dead end at ${current}`);
    seen.add(next);
    moves.push({
      role: Role.culprit,
      type: 'taxi',
      position: next,
      secret: false,
      double: false,
      ...(flags[i] ?? {}),
    });
    current = next;
  }
  return moves;
}

function run(moves: Move[]) {
  return computePossiblePositions(moves, GAME_GRAPH, buildDetectivesByTurn(moves, detectives), detectiveStarts);
}

describe('deduction engine reveal rounds', () => {
  it('deductionEngine_plainThirdMove_collapsesToRevealedNode', () => {
    const moves = culpritWalk(13, 3);
    expect([...run(moves).possible]).toEqual([moves[2].position]);
  });

  it('deductionEngine_doubleOnMovesTwoAndThree_revealsSecondLegNotFirst', () => {
    const moves = culpritWalk(13, 3, [{}, { double: true }, {}]);
    const { possible, weights } = run(moves);

    expect([...possible]).toEqual([moves[2].position]);
    expect(weights.get(moves[2].position)).toBe(1);
  });

  it('deductionEngine_doubleOnMovesThreeAndFour_revealsFirstLegThenExpandsOnce', () => {
    const moves = culpritWalk(13, 4, [{}, {}, { double: true }, {}]);
    const revealed = moves[2].position;
    const expected = new Set(GAME_GRAPH.get(revealed)?.taxi?.filter(n => n !== revealed) ?? []);

    const { possible } = run(moves);

    expect(possible).toEqual(expected);
    expect(possible.has(moves[3].position)).toBe(true);
  });

  it('deductionEngine_doubleAcrossReveal_laterRevealStillConsistent', () => {
    // Double on 2+3, then plain moves through the reveal at 8. Must not throw.
    const moves = culpritWalk(13, 8, [{}, { double: true }]);
    expect(() => run(moves)).not.toThrow();
    expect([...run(moves).possible]).toEqual([moves[7].position]);
  });

  it('deductionEngine_doubleWithSecretSecondLeg_stillRevealsOnReveal', () => {
    const moves = culpritWalk(13, 3, [{}, { double: true }, { secret: true }]);
    expect([...run(moves).possible]).toEqual([moves[2].position]);
  });
});
