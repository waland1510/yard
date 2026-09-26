import { GAME_GRAPH, Move, Player, Role } from '@yard/shared-utils';
import {
  TOTAL_ROUNDS,
  applyMove,
  findCaptor,
  initialGameState,
  seededStartingPositions,
  simulateGame,
} from './simulate-game';
import { defined } from '../test-utils/defined';

function firstTaxi(player: Player): Move | null {
  const node = GAME_GRAPH.get(player.position);
  const next = node?.taxi?.[0];
  if (next == null || player.taxiTickets <= 0) return null;
  return { role: player.role, type: 'taxi', position: next, secret: false, double: false };
}

describe('simulateGame', () => {
  it('seededStartingPositions_sameSeed_sameSixDistinctNodes', () => {
    const a = seededStartingPositions(42);
    const b = seededStartingPositions(42);
    expect(a).toEqual(b);
    expect(new Set(Object.values(a)).size).toBe(6);
    expect(seededStartingPositions(43)).not.toEqual(a);
  });

  it('initialGameState_marksEveryPlayerAsAiAndStartsWithCulprit', () => {
    const state = initialGameState(7);
    expect(state.players).toHaveLength(6);
    expect(state.players.every(p => p.isAI)).toBe(true);
    expect(state.currentTurn).toBe('culprit');
    expect(state.moves).toEqual([]);
  });

  it('applyMove_spendsTicketAdvancesTurnAndRecordsMove', () => {
    const state = initialGameState(1);
    const culprit = defined(state.players.find(p => p.role === Role.culprit), 'culprit');
    const dest = defined(GAME_GRAPH.get(culprit.position)?.taxi?.[0], 'taxi neighbour');

    const next = applyMove(state, { role: Role.culprit, type: 'taxi', position: dest });

    const moved = defined(next.players.find(p => p.role === Role.culprit), 'moved culprit');
    expect(moved.position).toBe(dest);
    expect(moved.taxiTickets).toBe(culprit.taxiTickets - 1);
    expect(next.currentTurn).toBe(Role.detective1);
    expect(next.moves).toHaveLength(1);
    expect(next.moves[0].secret).toBe(false);
  });

  it('applyMove_doubleMove_keepsTurnWithCulprit', () => {
    const state = initialGameState(1);
    const culprit = defined(state.players.find(p => p.role === Role.culprit), 'culprit');
    const dest = defined(GAME_GRAPH.get(culprit.position)?.taxi?.[0], 'taxi neighbour');

    const next = applyMove(state, { role: Role.culprit, type: 'taxi', position: dest, double: true });

    expect(next.currentTurn).toBe(Role.culprit);
    expect(next.isDoubleMove).toBe(true);
    expect(defined(next.players.find(p => p.role === Role.culprit), 'culprit').doubleTickets).toBe(1);
  });

  it('findCaptor_detectiveOnCulpritNode_returnsThatDetective', () => {
    const state = initialGameState(1);
    const culprit = defined(state.players.find(p => p.role === Role.culprit), 'culprit');
    const withCapture = {
      ...state,
      players: state.players.map(p => (p.role === Role.detective2 ? { ...p, position: culprit.position } : p)),
    };
    expect(findCaptor(state)).toBeNull();
    expect(findCaptor(withCapture)?.role).toBe(Role.detective2);
  });

  it('simulateGame_detectivesNeverMove_culpritEscapesAfterTotalRounds', async () => {
    const result = await simulateGame({
      seed: 3,
      decideDetective: async () => null,
      decideCulprit: async (_state, culprit) => {
        const move = firstTaxi(culprit);
        if (!move) throw new Error('stranded');
        return move;
      },
    });

    expect(result.winner).toBe('culprit');
    expect(result.rounds).toBe(TOTAL_ROUNDS);
    expect(result.captor).toBeNull();
  });

  it('simulateGame_detectiveStepsOntoCulprit_detectivesWinImmediately', async () => {
    const result = await simulateGame({
      seed: 5,
      decideCulprit: async (_state, culprit) => {
        const move = firstTaxi(culprit);
        if (!move) throw new Error('stranded');
        return move;
      },
      decideDetective: async (state, detective) => {
        const culprit = defined(state.players.find(p => p.role === Role.culprit), 'culprit');
        // Teleport onto Mr. X: legality is the policy's job, not the simulator's.
        return { role: detective.role, type: 'taxi', position: culprit.position };
      },
    });

    expect(result.winner).toBe('detectives');
    expect(result.rounds).toBe(1);
    expect(result.captor).toBe(Role.detective1);
  });

  it('simulateGame_nobodyCanMove_terminatesAsCulpritWin', async () => {
    const result = await simulateGame({
      seed: 9,
      decideDetective: async () => null,
      decideCulprit: async () => {
        throw new Error('stranded');
      },
    });

    expect(result.winner).toBe('culprit');
    expect(result.totalMoves).toBe(0);
  });

  it('simulateGame_sameSeedAndDeterministicPolicies_sameOutcome', async () => {
    const options = {
      seed: 11,
      decideDetective: async (_s: unknown, d: Player) => firstTaxi(d),
      decideCulprit: async (_s: unknown, c: Player) => {
        const move = firstTaxi(c);
        if (!move) throw new Error('stranded');
        return move;
      },
    };
    const a = await simulateGame(options);
    const b = await simulateGame(options);
    expect(a).toEqual(b);
  });
});
