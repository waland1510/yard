import type { Move, Player } from '@yard/shared-utils';
import {
  validateMove,
  legalDestinations,
  spendsSecretTicket,
  culpritEscaped,
  deriveWinner,
  TOTAL_ROUNDS,
} from './move-validator';

// Node 115 has river edges (to 108 and 157) plus taxi edges; 108 is also taxi-reachable
// from 115. Node 1 is taxi-linked to 8 and 9.
function player(role: Player['role'], position: number, extra: Partial<Player> = {}): Player {
  return {
    id: 1,
    role,
    position,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
    secretTickets: 5,
    doubleTickets: 2,
    ...extra,
  };
}

describe('validateMove', () => {
  it('validateMove_culpritRiverWithNoSecretTickets_returnsNoSecretTickets', () => {
    const culprit = player('culprit', 115, { secretTickets: 0 });
    const verdict = validateMove(
      { role: 'culprit', targetNodeId: 157, transport: 'river' },
      { currentTurn: 'culprit', players: [culprit] }
    );
    expect(verdict).toEqual({ ok: false, reason: 'no-secret-tickets' });
  });

  it('validateMove_culpritRiverWithSecretTickets_returnsOk', () => {
    const culprit = player('culprit', 115, { secretTickets: 1 });
    const verdict = validateMove(
      { role: 'culprit', targetNodeId: 157, transport: 'river' },
      { currentTurn: 'culprit', players: [culprit] }
    );
    expect(verdict).toEqual({ ok: true });
  });

  it('validateMove_culpritOntoDetectiveNode_returnsNodeOccupied', () => {
    const culprit = player('culprit', 1);
    const detective = player('detective1', 8);
    const verdict = validateMove(
      { role: 'culprit', targetNodeId: 8, transport: 'taxi' },
      { currentTurn: 'culprit', players: [culprit, detective] }
    );
    expect(verdict).toEqual({ ok: false, reason: 'node-occupied' });
  });

  it('validateMove_detectiveOntoCulpritNode_returnsOk', () => {
    const culprit = player('culprit', 8);
    const detective = player('detective1', 1);
    const verdict = validateMove(
      { role: 'detective1', targetNodeId: 8, transport: 'taxi' },
      { currentTurn: 'detective1', players: [culprit, detective] }
    );
    expect(verdict).toEqual({ ok: true });
  });
});

describe('legalDestinations', () => {
  it('legalDestinations_culpritTaxi_excludesDetectiveOccupiedNodes', () => {
    const culprit = player('culprit', 1);
    const detective = player('detective1', 8);
    const dests = legalDestinations('culprit', 'taxi', {
      currentTurn: 'culprit',
      players: [culprit, detective],
    });
    expect(dests).not.toContain(8);
    expect(dests).toContain(9);
  });
});

describe('spendsSecretTicket', () => {
  it('spendsSecretTicket_river_returnsTrue', () => {
    expect(spendsSecretTicket('river', false)).toBe(true);
  });

  it('spendsSecretTicket_taxiWithoutSecret_returnsFalse', () => {
    expect(spendsSecretTicket('taxi', false)).toBe(false);
  });
});

describe('culpritEscaped', () => {
  const culpritMoves = (n: number): Move[] =>
    Array.from({ length: n }, (_, i) => ({ role: 'culprit', type: 'taxi', position: i + 1 }));

  it('culpritEscaped_fewerThanTotalRounds_returnsFalse', () => {
    expect(culpritEscaped(culpritMoves(TOTAL_ROUNDS - 1))).toBe(false);
  });

  it('culpritEscaped_totalRoundsReached_returnsTrue', () => {
    expect(culpritEscaped(culpritMoves(TOTAL_ROUNDS))).toBe(true);
  });

  it('culpritEscaped_detectiveMovesOnly_returnsFalse', () => {
    const moves: Move[] = Array.from({ length: 30 }, () => ({
      role: 'detective1',
      type: 'taxi',
      position: 1,
    }));
    expect(culpritEscaped(moves)).toBe(false);
  });
});

describe('deriveWinner', () => {
  it('deriveWinner_serverSaysDetectives_returnsCapturingDetective', () => {
    const players = [player('culprit', 8), player('detective1', 1), player('detective2', 8)];
    expect(deriveWinner('detectives', players, [])).toBe('detective2');
  });

  it('deriveWinner_serverSaysCulprit_returnsCulprit', () => {
    const players = [player('culprit', 8), player('detective1', 1)];
    expect(deriveWinner('culprit', players, [])).toBe('culprit');
  });

  it('deriveWinner_noHintAndCulpritEscaped_returnsCulprit', () => {
    const players = [player('culprit', 8), player('detective1', 1)];
    const moves: Move[] = Array.from({ length: TOTAL_ROUNDS }, () => ({
      role: 'culprit',
      type: 'taxi',
      position: 8,
    }));
    expect(deriveWinner(undefined, players, moves)).toBe('culprit');
  });

  it('deriveWinner_noHintNoCaptureNoEscape_returnsNull', () => {
    const players = [player('culprit', 8), player('detective1', 1)];
    expect(deriveWinner(undefined, players, [])).toBeNull();
  });
});
