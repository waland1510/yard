// Initializes a mock single-player session so the FPV stays playable when there's no
// backend or no URL session. The mock fills the same stores the real WS handlers would —
// downstream UI doesn't branch on mode.

import type { Player, RoleType } from '@yard/shared-utils';
import { useGameStateStore } from '../stores/game-state-store';
import { pickDemoStartingNode } from '../core/map-data';

const MOCK_TICKETS = {
  detective: { taxi: 11, bus: 8, underground: 4 },
  culprit: { taxi: 4, bus: 3, underground: 3, secret: 5, double: 2 },
};

export function initializeMockSession(
  localRole: RoleType = 'detective1',
  localName = 'Player',
  channel = 'mock'
) {
  const startNode = pickDemoStartingNode();

  // Build a 6-player roster. The local player starts at startNode; others scattered
  // deterministically so they don't overlap.
  const detectiveStarts = [13, 26, 29, 34, 50, 53];
  const players: Player[] = [];

  const culprit: Player = {
    id: 1,
    role: 'culprit',
    position: 132,
    taxiTickets: MOCK_TICKETS.culprit.taxi,
    busTickets: MOCK_TICKETS.culprit.bus,
    undergroundTickets: MOCK_TICKETS.culprit.underground,
    secretTickets: MOCK_TICKETS.culprit.secret,
    doubleTickets: MOCK_TICKETS.culprit.double,
  };
  players.push(culprit);

  for (let i = 1; i <= 5; i++) {
    const role = `detective${i}` as RoleType;
    players.push({
      id: i + 1,
      role,
      position: role === localRole ? startNode : detectiveStarts[i - 1] ?? startNode,
      taxiTickets: MOCK_TICKETS.detective.taxi,
      busTickets: MOCK_TICKETS.detective.bus,
      undergroundTickets: MOCK_TICKETS.detective.underground,
    });
  }

  // If local is culprit, place them at a river-connected node so the ferry vehicle is
  // immediately reachable in the demo. The 4 river nodes are 115, 118, 157, 194.
  if (localRole === 'culprit') {
    culprit.position = 115;
  }

  useGameStateStore.getState().applyServerState({
    channel,
    players,
    moves: [],
    currentTurn: localRole, // local is up first so user can immediately move
    status: 'active',
    isDoubleMove: false,
  });

  return { localRole, localName, startNode };
}
