import { GAME_GRAPH, GameState, Player, Role } from '@yard/shared-utils';
import { buildCandidates, buildTacticalPicture, hopDistance } from './move-candidates';

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

function makeGameState(players: Player[], moves: GameState['moves'] = []): GameState {
  return {
    channel: 'test',
    players,
    currentTurn: Role.detective1,
    moves,
    isDoubleMove: false,
    status: 'active',
  };
}

describe('moveCandidates', () => {
  it('moveCandidates_atHubNode_listsEveryDestinationOnceViaItsPlentifulTransport', () => {
    const detective = makeDetective();
    const candidates = buildCandidates({
      gameState: makeGameState([detective]),
      detective,
      possible: new Set<number>(),
      weights: new Map<number, number>(),
    });

    const node = GAME_GRAPH.get(HUB)!;
    const destinations = new Set([...(node.taxi ?? []), ...(node.bus ?? []), ...(node.underground ?? [])]);

    expect(new Set(candidates.map(c => c.move.position))).toEqual(destinations);
    expect(candidates).toHaveLength(destinations.size);
    expect(candidates.every(c => c.move.role === Role.detective1)).toBe(true);

    const remaining = { taxi: 10, bus: 8, underground: 4 } as const;
    for (const c of candidates) {
      const reaching = (['taxi', 'bus', 'underground'] as const).filter(t => node[t]?.includes(c.move.position));
      const plentiful = reaching.reduce((best, t) => (remaining[t] > remaining[best] ? t : best), reaching[0]);
      expect(c.move.type).toBe(plentiful);
    }
  });

  it('moveCandidates_destinationOccupiedByDetective_isExcluded', () => {
    const detective = makeDetective();
    const blockedNode = GAME_GRAPH.get(HUB)!.taxi![0];
    const blocker: Player = makeDetective({
      id: 2,
      role: Role.detective2,
      position: blockedNode,
    });

    const candidates = buildCandidates({
      gameState: makeGameState([detective, blocker]),
      detective,
      possible: new Set<number>(),
      weights: new Map<number, number>(),
    });

    expect(candidates.some(c => c.move.position === blockedNode)).toBe(false);
  });

  it('moveCandidates_landsOnSuspect_setsFlagAndMass', () => {
    const detective = makeDetective();
    const target = GAME_GRAPH.get(HUB)!.taxi![0];

    const candidates = buildCandidates({
      gameState: makeGameState([detective]),
      detective,
      possible: new Set<number>([target]),
      weights: new Map<number, number>([[target, 1]]),
    });

    const landing = candidates.find(c => c.move.position === target)!;
    expect(landing.landsOnSuspect).toBe(true);
    expect(landing.suspectMassWithin1).toBeCloseTo(1);
    expect(landing.hopsToTopSuspect).toBe(0);

    const others = candidates.filter(c => c.move.position !== target);
    expect(others.every(c => c.landsOnSuspect === false)).toBe(true);
  });

  it('moveCandidates_noTickets_returnsEmpty', () => {
    const detective = makeDetective({ taxiTickets: 0, busTickets: 0, undergroundTickets: 0 });

    const candidates = buildCandidates({
      gameState: makeGameState([detective]),
      detective,
      possible: new Set<number>(),
      weights: new Map<number, number>(),
    });

    expect(candidates).toEqual([]);
  });

  it('moveCandidates_sameDestinationByTwoTransports_keepsThePlentifulTicket', () => {
    let origin: number | null = null;
    let shared: number | null = null;
    for (const [id, node] of GAME_GRAPH) {
      const both = (node.taxi ?? []).find(n => (node.bus ?? []).includes(n));
      if (both != null) { origin = id; shared = both; break; }
    }
    expect(origin).not.toBeNull();

    const detective = makeDetective({ position: origin!, taxiTickets: 6, busTickets: 1 });
    const candidates = buildCandidates({
      gameState: makeGameState([detective]),
      detective,
      possible: new Set<number>(),
      weights: new Map<number, number>(),
    });

    const toShared = candidates.filter(c => c.move.position === shared);
    expect(toShared).toHaveLength(1);
    expect(toShared[0].move.type).toBe('taxi');

    const busOnly = makeDetective({ position: origin!, taxiTickets: 1, busTickets: 6 });
    const flipped = buildCandidates({
      gameState: makeGameState([busOnly]),
      detective: busOnly,
      possible: new Set<number>(),
      weights: new Map<number, number>(),
    }).filter(c => c.move.position === shared);
    expect(flipped).toHaveLength(1);
    expect(flipped[0].move.type).toBe('bus');
  });

  it('moveCandidates_ticketAfter_reflectsSpentTicket', () => {
    const detective = makeDetective({ taxiTickets: 3 });
    const candidates = buildCandidates({
      gameState: makeGameState([detective]),
      detective,
      possible: new Set<number>(),
      weights: new Map<number, number>(),
    });

    const taxiCandidate = candidates.find(c => c.move.type === 'taxi')!;
    expect(taxiCandidate.ticketAfter).toBe(2);
  });

  it('hopDistance_adjacentNodes_returnsOne', () => {
    const neighbor = GAME_GRAPH.get(HUB)!.taxi![0];
    expect(hopDistance(HUB, HUB)).toBe(0);
    expect(hopDistance(HUB, neighbor)).toBe(1);
  });

  it('tacticalPicture_afterRevealRound_reportsLastRevealAndNextReveal', () => {
    const detective = makeDetective();
    const moves: GameState['moves'] = [
      { role: Role.culprit, type: 'taxi', position: 10, secret: false, double: false },
      { role: Role.culprit, type: 'taxi', position: 20, secret: false, double: false },
      { role: Role.culprit, type: 'taxi', position: 30, secret: false, double: false },
      { role: Role.culprit, type: 'taxi', position: 40, secret: false, double: false },
    ];

    const picture = buildTacticalPicture({
      gameState: makeGameState([detective], moves),
      detective,
      possible: new Set<number>([40]),
      weights: new Map<number, number>([[40, 1]]),
    });

    expect(picture.round).toBe(4);
    expect(picture.lastRevealed).toEqual({ node: 30, roundsAgo: 1 });
    expect(picture.nextRevealInRounds).toBe(4);
    expect(picture.topSuspects[0]).toEqual({ node: 40, probability: 1 });
  });
});
