import { AiProposal, Role } from '@yard/shared-utils';
import { AiProposalRegistry } from './ai-proposal-registry';

function proposal(id: string): AiProposal {
  const heuristic = { type: 'taxi' as const, position: 10, role: Role.detective1 };
  const jev = { type: 'bus' as const, position: 20, role: Role.detective1 };
  return {
    id,
    role: Role.detective1,
    moveIndex: 4,
    options: [
      { source: 'heuristic', move: heuristic },
      { source: 'jev', move: jev, confidence: 0.7 },
    ],
    expiresAt: Date.now() + 1000,
    comparison: {
      role: Role.detective1,
      moveIndex: 4,
      chosen: 'heuristic',
      agree: false,
      jevEnabled: true,
      heuristic: { move: heuristic, rankInJev: 1 },
      jev: { move: jev, confidence: 0.7, model: 'jev', latencyMs: 100, top: [] },
    },
  };
}

describe('AiProposalRegistry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('proposalRegistry_humanChoosesJev_resolvesWithJev', async () => {
    const registry = new AiProposalRegistry();
    const outcome = registry.open('ch', proposal('p1'), 5000);

    expect(registry.choose('ch', 'p1', 'jev')).toBe(true);
    await expect(outcome).resolves.toEqual({ source: 'jev', chosenBy: 'human' });
    expect(registry.current('ch')).toBeNull();
  });

  it('proposalRegistry_noChoice_timesOutToHeuristic', async () => {
    const registry = new AiProposalRegistry();
    const outcome = registry.open('ch', proposal('p1'), 5000);

    jest.advanceTimersByTime(5000);
    await expect(outcome).resolves.toEqual({ source: 'heuristic', chosenBy: 'timeout' });
  });

  it('proposalRegistry_staleOrForeignChoice_isIgnored', async () => {
    const registry = new AiProposalRegistry();
    const outcome = registry.open('ch', proposal('p2'), 5000);

    expect(registry.choose('ch', 'p1', 'jev')).toBe(false);
    expect(registry.choose('other', 'p2', 'jev')).toBe(false);
    expect(registry.choose('ch', 'p2', 'legacy' as never)).toBe(false);
    expect(registry.current('ch')?.id).toBe('p2');

    registry.choose('ch', 'p2', 'heuristic');
    await expect(outcome).resolves.toEqual({ source: 'heuristic', chosenBy: 'human' });
  });

  it('proposalRegistry_secondChoice_afterResolve_isIgnored', async () => {
    const registry = new AiProposalRegistry();
    registry.open('ch', proposal('p1'), 5000);
    expect(registry.choose('ch', 'p1', 'jev')).toBe(true);
    expect(registry.choose('ch', 'p1', 'heuristic')).toBe(false);
  });

  it('proposalRegistry_openAgain_cancelsPreviousWithFallback', async () => {
    const registry = new AiProposalRegistry();
    const first = registry.open('ch', proposal('p1'), 5000);
    registry.open('ch', proposal('p2'), 5000);

    await expect(first).resolves.toEqual({ source: 'heuristic', chosenBy: 'timeout' });
    expect(registry.current('ch')?.id).toBe('p2');
  });
});
