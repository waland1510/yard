import type { AiDecisionComparison, Move } from '@yard/shared-utils';
import { useGameStateStore } from './game-state-store';

function makeComparison(overrides: Partial<AiDecisionComparison> = {}): AiDecisionComparison {
  const move: Move = { type: 'taxi', position: 42, role: 'detective1' };
  return {
    role: 'detective1',
    moveIndex: 0,
    chosen: 'jev',
    agree: true,
    jevEnabled: true,
    heuristic: { move, rankInJev: 0 },
    jev: {
      move,
      confidence: 0.9,
      model: 'jev-1.13.0',
      latencyMs: 120,
      top: [{ key: 'taxi_42', move, probability: 0.8 }],
    },
    ...overrides,
  };
}

describe('gameStateStore ai decisions', () => {
  beforeEach(() => {
    useGameStateStore.getState().reset();
  });

  it('gameStore_onAiDecision_appendsToBuffer', () => {
    useGameStateStore.getState().recordAiDecision(makeComparison());

    const { aiDecisions } = useGameStateStore.getState();
    expect(aiDecisions).toHaveLength(1);
    expect(aiDecisions[0].chosen).toBe('jev');
  });

  it('gameStore_onManyAiDecisions_keepsOnlyLastTwenty', () => {
    for (let i = 0; i < 25; i++) {
      useGameStateStore.getState().recordAiDecision(makeComparison({ moveIndex: i }));
    }

    const { aiDecisions } = useGameStateStore.getState();
    expect(aiDecisions).toHaveLength(20);
    expect(aiDecisions[0].moveIndex).toBe(5);
    expect(aiDecisions[19].moveIndex).toBe(24);
  });

  it('gameStore_onReset_clearsAiDecisions', () => {
    useGameStateStore.getState().recordAiDecision(makeComparison());
    useGameStateStore.getState().reset();

    expect(useGameStateStore.getState().aiDecisions).toEqual([]);
  });
});
