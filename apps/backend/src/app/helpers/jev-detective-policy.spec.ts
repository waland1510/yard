import { GAME_GRAPH, GameState, Player, Role } from '@yard/shared-utils';

const systemOne = jest.fn();
jest.mock('./jev-client', () => ({
  jevEnabled: () => mockEnabled,
  getJevClient: () => (mockEnabled ? { systemOne } : null),
  resetJevClient: () => undefined,
}));

let mockEnabled = true;

import { JevDetectivePolicy, buildState, describeCandidate, describeContext, shuffleForDecision } from './jev-detective-policy';
import { buildTacticalPicture } from './move-candidates';

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

function setup() {
  const detective = makeDetective();
  const gameState = makeGameState([detective]);
  const picture = buildTacticalPicture({
    gameState,
    detective,
    possible: new Set<number>(),
    weights: new Map<number, number>(),
  });
  return { detective, gameState, picture };
}

describe('JevDetectivePolicy', () => {
  const policy = new JevDetectivePolicy();

  beforeEach(() => {
    mockEnabled = true;
    systemOne.mockReset();
  });

  it('jevPolicy_validChoice_returnsMappedMove', async () => {
    const { detective, gameState, picture } = setup();
    const target = picture.candidates[1];

    systemOne.mockResolvedValue({
      model: 'jev-1.13.0',
      answers: {
        move: {
          type: 'choice',
          choice: target.key,
          confidence: 0.82,
          probabilities: { [target.key]: 0.9, [picture.candidates[0].key]: 0.1 },
        },
      },
      usage: { input_tokens: 400, output_tokens: 12 },
    });

    const result = await policy.decide(gameState, detective, picture);

    expect(result).not.toBeNull();
    expect(result!.move).toEqual(target.move);
    expect(result!.details.confidence).toBe(0.82);
    expect(result!.details.model).toBe('jev-1.13.0');
    expect(result!.ranked[0]).toBe(target.key);
  });

  it('jevPolicy_unknownKey_returnsNull', async () => {
    const { detective, gameState, picture } = setup();

    systemOne.mockResolvedValue({
      model: 'jev-1.13.0',
      answers: {
        move: { type: 'choice', choice: 'taxi_99999', confidence: 1, probabilities: {} },
      },
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    expect(await policy.decide(gameState, detective, picture)).toBeNull();
  });

  it('jevPolicy_timeout_propagatesForArbiterToCatch', async () => {
    const { detective, gameState, picture } = setup();
    systemOne.mockRejectedValue(new Error('timed out'));

    await expect(policy.decide(gameState, detective, picture)).rejects.toThrow('timed out');
  });

  it('jevPolicy_noApiKey_neverCallsClient', async () => {
    mockEnabled = false;
    const { detective, gameState, picture } = setup();

    expect(await policy.decide(gameState, detective, picture)).toBeNull();
    expect(systemOne).not.toHaveBeenCalled();
  });

  it('jevPolicy_noCandidates_neverCallsClient', async () => {
    const detective = makeDetective({ taxiTickets: 0, busTickets: 0, undergroundTickets: 0 });
    const gameState = makeGameState([detective]);
    const picture = buildTacticalPicture({
      gameState,
      detective,
      possible: new Set<number>(),
      weights: new Map<number, number>(),
    });

    expect(await policy.decide(gameState, detective, picture)).toBeNull();
    expect(systemOne).not.toHaveBeenCalled();
  });

  it('jevPolicy_statePayload_carriesPrecomputedFactsNotRawGraph', () => {
    const { detective, picture } = setup();
    const state = buildState(detective, picture);
    const serialized = JSON.stringify(state);

    expect(state.thisDetective.atNode).toBe(HUB);
    expect(serialized.length).toBeLessThan(4000);
    expect(serialized).not.toContain('"taxi":[');
  });

  it('jevPolicy_candidateDescription_statesCaptureChanceInWords', () => {
    const { picture } = setup();
    const candidate = { ...picture.candidates[0], landsOnSuspect: true, suspectMassWithin1: 0.5 };

    const text = describeCandidate(candidate, describeContext(picture.candidates));

    expect(text).toContain('possible Mr. X location');
    expect(text).toContain('50%');
    expect(text).toMatch(/\d+ hops|No route/);
  });

  it('jevPolicy_ticketCost_isStatedRelativeToOtherOptions', () => {
    const { picture } = setup();
    const rich = { ...picture.candidates[0], ticketAfter: 8 };
    const poor = { ...picture.candidates[1], ticketAfter: 3 };
    const context = describeContext([rich, poor]);

    expect(describeCandidate(rich, context)).toContain('Cheapest option');
    expect(describeCandidate(poor, context)).toContain('scarcer');
    expect(describeCandidate({ ...poor, ticketAfter: 0 }, context)).toContain('last');
  });

  it('jevPolicy_optionOrder_isShuffledDeterministicallyPerDecision', () => {
    const { picture } = setup();
    const a = shuffleForDecision(picture.candidates, 'seed-a').map(c => c.key);
    const b = shuffleForDecision(picture.candidates, 'seed-a').map(c => c.key);
    const c = shuffleForDecision(picture.candidates, 'seed-b').map(c => c.key);

    expect(a).toEqual(b);
    expect(new Set(a)).toEqual(new Set(picture.candidates.map(x => x.key)));
    expect(a.join() === c.join() && a.join() === picture.candidates.map(x => x.key).join()).toBe(false);
  });
});
