import { GAME_GRAPH, GameState, Player, Role } from '@yard/shared-utils';

let mockEnabled = true;
let mockMinConfidence = 0;

jest.mock('./jev-client', () => ({
  jevEnabled: () => mockEnabled,
  getJevClient: () => null,
  resetJevClient: () => undefined,
}));

jest.mock('./env', () => ({
  get ENV() {
    return {
      JEV_MIN_CONFIDENCE: mockMinConfidence,
      JEV_TIMEOUT_MS: 4000,
      JEV_MODEL: 'jev-latest',
      TYPESAFE_API_KEY: 'test',
      AI_DETECTIVE_POLICY: 'jev',
    };
  },
}));

import { DetectiveDecisionArbiter } from './ai-decision-arbiter';
import { HeuristicDetectivePolicy } from './heuristic-detective-policy';
import { JevDetectivePolicy, JevPolicyResult } from './jev-detective-policy';
import { PolicyResult, TacticalPicture } from './detective-policy';
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

function stubJev(fn: (picture: TacticalPicture) => JevPolicyResult | null | Promise<never>) {
  const jev = new JevDetectivePolicy();
  jest
    .spyOn(jev, 'decide')
    .mockImplementation(async (_g, _d, picture) => fn(picture) as JevPolicyResult | null);
  return jev;
}

function jevResultFor(picture: TacticalPicture, index: number, confidence = 0.9): JevPolicyResult {
  const candidate = picture.candidates[index];
  const ranked = [
    candidate.key,
    ...picture.candidates.filter(c => c.key !== candidate.key).map(c => c.key),
  ];
  return {
    move: candidate.move,
    ranked,
    details: {
      confidence,
      probabilities: Object.fromEntries(
        ranked.map((key, i) => [key, i === 0 ? 0.8 : 0.2 / (ranked.length - 1)])
      ),
      model: 'jev-1.13.0',
      latencyMs: 120,
      usage: { inputTokens: 300, outputTokens: 10 },
    },
  };
}

describe('DetectiveDecisionArbiter', () => {
  beforeEach(() => {
    mockEnabled = true;
    mockMinConfidence = 0;
  });

  it('arbiter_jevDisabled_choosesHeuristicAndMarksJevEnabledFalse', async () => {
    mockEnabled = false;
    const detective = makeDetective();
    const gameState = makeGameState([detective]);
    const jev = stubJev(() => {
      throw new Error('should not be called');
    });
    const arbiter = new DetectiveDecisionArbiter(new HeuristicDetectivePolicy(), jev);

    const decision = defined(await arbiter.decide(gameState, detective), 'decision');

    expect(decision.source).toBe('heuristic');
    expect(decision.comparison.jevEnabled).toBe(false);
    expect(decision.comparison.jev).toBeNull();
    expect(decision.comparison.agree).toBe(false);
    expect(jev.decide).not.toHaveBeenCalled();
  });

  it('arbiter_jevAnswers_prefersJev', async () => {
    const detective = makeDetective();
    const gameState = makeGameState([detective]);
    const jev = stubJev(picture => jevResultFor(picture, picture.candidates.length - 1));
    const arbiter = new DetectiveDecisionArbiter(new HeuristicDetectivePolicy(), jev);

    const decision = defined(await arbiter.decide(gameState, detective), 'decision');

    expect(decision.source).toBe('jev');
    const jevPick = defined(decision.comparison.jev, 'jev');
    expect(decision.move).toEqual(jevPick.move);
    expect(jevPick.top.length).toBeGreaterThan(0);
  });

  it('arbiter_jevFails_fallsBackToHeuristicWithError', async () => {
    const detective = makeDetective();
    const gameState = makeGameState([detective]);
    const jev = new JevDetectivePolicy();
    jest.spyOn(jev, 'decide').mockRejectedValue(new Error('timed out'));
    const arbiter = new DetectiveDecisionArbiter(new HeuristicDetectivePolicy(), jev);

    const decision = defined(await arbiter.decide(gameState, detective), 'decision');

    expect(decision.source).toBe('heuristic');
    expect(decision.comparison.jevError).toBe('timed out');
    expect(decision.comparison.jev).toBeNull();
    expect(decision.comparison.jevEnabled).toBe(true);
  });

  it('arbiter_belowMinConfidence_fallsBackToHeuristic', async () => {
    mockMinConfidence = 0.7;
    const detective = makeDetective();
    const gameState = makeGameState([detective]);
    const jev = stubJev(picture => jevResultFor(picture, picture.candidates.length - 1, 0.3));
    const arbiter = new DetectiveDecisionArbiter(new HeuristicDetectivePolicy(), jev);

    const decision = defined(await arbiter.decide(gameState, detective), 'decision');

    expect(decision.source).toBe('heuristic');
    expect(decision.comparison.jev).not.toBeNull();
    expect(defined(decision.comparison.jev, 'jev').confidence).toBe(0.3);
  });

  it('arbiter_sameMove_agreeTrueAndRankZero', async () => {
    const detective = makeDetective();
    const gameState = makeGameState([detective]);
    const heuristic = new HeuristicDetectivePolicy();

    const picturePeek: { value: TacticalPicture | null } = { value: null };
    const originalDecide = heuristic.decide.bind(heuristic);
    jest
      .spyOn(heuristic, 'decide')
      .mockImplementation(async (g, d, picture): Promise<PolicyResult | null> => {
        picturePeek.value = picture;
        return originalDecide(g, d, picture);
      });

    const jev = new JevDetectivePolicy();
    jest.spyOn(jev, 'decide').mockImplementation(async (_g, _d, picture) => {
      const heuristicPick = defined(await originalDecide(gameState, detective, picture), 'heuristic pick').move;
      const index = picture.candidates.findIndex(
        c => c.move.position === heuristicPick.position && c.move.type === heuristicPick.type
      );
      return jevResultFor(picture, index);
    });

    const arbiter = new DetectiveDecisionArbiter(heuristic, jev);
    const decision = defined(await arbiter.decide(gameState, detective), 'decision');

    expect(decision.comparison.agree).toBe(true);
    expect(decision.comparison.heuristic.rankInJev).toBe(0);
  });

  it('arbiter_strandedDetective_returnsNull', async () => {
    mockEnabled = false;
    const detective = makeDetective({ taxiTickets: 0, busTickets: 0, undergroundTickets: 0 });
    const gameState = makeGameState([detective]);
    const arbiter = new DetectiveDecisionArbiter(
      new HeuristicDetectivePolicy(),
      stubJev(() => null)
    );

    expect(await arbiter.decide(gameState, detective)).toBeNull();
  });
});
