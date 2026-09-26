import { GAME_GRAPH, GameState, Player, Role } from '@yard/shared-utils';
import { HeuristicDetectivePolicy } from './heuristic-detective-policy';
import { buildTacticalPicture } from './move-candidates';
import { defined } from '../../test-utils/defined';

function nodeWithAllTransports(): number {
  for (const [id, node] of GAME_GRAPH) {
    if (node.taxi?.length && node.bus?.length && node.underground?.length) return id;
  }
  throw new Error('no node with all three transports');
}

const HUB = nodeWithAllTransports();

function makeDetective(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    role: Role.detective1,
    position: HUB,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
    isAI: true,
    ...overrides,
  };
}

function makeGameState(players: Player[]): GameState {
  return {
    channel: 'test',
    players,
    currentTurn: Role.detective1,
    moves: [],
    isDoubleMove: false,
    status: 'active',
  };
}

describe('HeuristicDetectivePolicy', () => {
  const policy = new HeuristicDetectivePolicy();

  it('heuristicPolicy_suspectOnAdjacentNode_movesOntoIt', async () => {
    const detective = makeDetective();
    const target = defined(GAME_GRAPH.get(HUB)?.taxi?.[0], 'taxi neighbour');
    const gameState = makeGameState([detective]);

    const picture = buildTacticalPicture({
      gameState,
      detective,
      possible: new Set<number>([target]),
      weights: new Map<number, number>([[target, 1]]),
    });

    const result = defined(await policy.decide(gameState, detective, picture), 'result');

    expect(result).not.toBeNull();
    expect(result.move.position).toBe(target);
    expect(result.ranked[0]).toBe(`taxi_${target}`);
  });

  it('heuristicPolicy_rankedList_coversEveryCandidate', async () => {
    const detective = makeDetective();
    const gameState = makeGameState([detective]);
    const picture = buildTacticalPicture({
      gameState,
      detective,
      possible: new Set<number>(),
      weights: new Map<number, number>(),
    });

    const result = defined(await policy.decide(gameState, detective, picture), 'result');

    expect(result.ranked).toHaveLength(picture.candidates.length);
    expect(new Set(result.ranked).size).toBe(picture.candidates.length);
  });

  it('heuristicPolicy_neverMovesOntoAnotherDetective', async () => {
    const detective = makeDetective();
    const blocked = defined(GAME_GRAPH.get(HUB)?.taxi?.[0], 'taxi neighbour');
    const blocker = makeDetective({ id: 2, role: Role.detective2, position: blocked });
    const gameState = makeGameState([detective, blocker]);

    const picture = buildTacticalPicture({
      gameState,
      detective,
      possible: new Set<number>([blocked]),
      weights: new Map<number, number>([[blocked, 1]]),
    });

    const result = defined(await policy.decide(gameState, detective, picture), 'result');

    expect(result.move.position).not.toBe(blocked);
  });

  it('heuristicPolicy_strandedWithNoTickets_returnsNull', async () => {
    const detective = makeDetective({ taxiTickets: 0, busTickets: 0, undergroundTickets: 0 });
    const gameState = makeGameState([detective]);
    const picture = buildTacticalPicture({
      gameState,
      detective,
      possible: new Set<number>(),
      weights: new Map<number, number>(),
    });

    const result = await policy.decide(gameState, detective, picture);

    expect(result).toBeNull();
  });
});
