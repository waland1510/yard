// Pure rules engine. Given a proposed move + game state, decide if it's legal and why.
// No React, no I/O, no Three.js. Synchronous. Deterministic.
//
// Locked decision from PRD: detective-detective collision is enforced here, client-side.
// (Per the trust-the-client posture, this is the authoritative rule check at the client level.)

import type { MoveType, Player, RoleType } from '@yard/shared-utils';
import { getNode } from './map-data';

export type ValidationVerdict =
  | { ok: true }
  | { ok: false; reason: ValidationReason };

export type ValidationReason =
  | 'not-your-turn'
  | 'no-such-node'
  | 'invalid-connection'
  | 'no-ticket'
  | 'detective-collision'
  | 'river-not-allowed'
  | 'secret-not-allowed'
  | 'double-not-allowed'
  | 'no-double-tickets'
  | 'no-secret-tickets';

export interface ValidationContext {
  currentTurn: RoleType;
  players: Player[];
}

export interface ProposedMove {
  role: RoleType;
  targetNodeId: number;
  transport: MoveType;
  secret?: boolean;
  double?: boolean;
}

export function validateMove(move: ProposedMove, ctx: ValidationContext): ValidationVerdict {
  // 1. Turn ownership
  if (move.role !== ctx.currentTurn) {
    return { ok: false, reason: 'not-your-turn' };
  }

  // 2. Player exists
  const me = ctx.players.find((p) => p.role === move.role);
  if (!me) return { ok: false, reason: 'not-your-turn' };

  // 3. Nodes exist
  const node = getNode(me.position);
  const target = getNode(move.targetNodeId);
  if (!node || !target) return { ok: false, reason: 'no-such-node' };

  const isCulprit = move.role === 'culprit';

  // 4. Detective-only restrictions on special moves
  if (!isCulprit) {
    if (move.transport === 'river') return { ok: false, reason: 'river-not-allowed' };
    if (move.secret) return { ok: false, reason: 'secret-not-allowed' };
    if (move.double) return { ok: false, reason: 'double-not-allowed' };
  }

  // 5. Connection existence
  if (move.secret) {
    // Secret ticket lets culprit use any edge type
    const reachable =
      (node.taxi?.includes(move.targetNodeId) ?? false) ||
      (node.bus?.includes(move.targetNodeId) ?? false) ||
      (node.underground?.includes(move.targetNodeId) ?? false) ||
      (node.river?.includes(move.targetNodeId) ?? false);
    if (!reachable) return { ok: false, reason: 'invalid-connection' };
  } else {
    const neighbors = node[move.transport] ?? [];
    if (!neighbors.includes(move.targetNodeId)) {
      return { ok: false, reason: 'invalid-connection' };
    }
  }

  // 6. Detective-detective collision (locked PRD decision #1, client-side enforcement)
  if (!isCulprit) {
    const others = ctx.players
      .filter((p) => p.role !== 'culprit' && p.role !== move.role)
      .map((p) => p.position);
    if (others.includes(move.targetNodeId)) {
      return { ok: false, reason: 'detective-collision' };
    }
  }

  // 7. Transport ticket availability (river is free for culprit)
  if (move.secret) {
    if ((me.secretTickets ?? 0) <= 0) return { ok: false, reason: 'no-secret-tickets' };
  } else if (move.transport === 'taxi') {
    if (me.taxiTickets <= 0) return { ok: false, reason: 'no-ticket' };
  } else if (move.transport === 'bus') {
    if (me.busTickets <= 0) return { ok: false, reason: 'no-ticket' };
  } else if (move.transport === 'underground') {
    if (me.undergroundTickets <= 0) return { ok: false, reason: 'no-ticket' };
  }
  // River for culprit: no ticket cost

  // 8. Double-move resource
  if (move.double) {
    if ((me.doubleTickets ?? 0) <= 0) return { ok: false, reason: 'no-double-tickets' };
  }

  return { ok: true };
}

/**
 * Which destinations are legal for the given (role, transport) from the player's current
 * node, given the current game state? Skips ticket checks — for UX pre-highlighting only.
 * Filters out detective-occupied nodes for detective moves.
 */
export function legalDestinations(
  role: RoleType,
  transport: MoveType | 'secret',
  ctx: ValidationContext
): number[] {
  const me = ctx.players.find((p) => p.role === role);
  if (!me) return [];
  const node = getNode(me.position);
  if (!node) return [];

  const isCulprit = role === 'culprit';
  let candidates: number[];
  if (transport === 'secret') {
    if (!isCulprit) return [];
    candidates = Array.from(
      new Set<number>([
        ...(node.taxi ?? []),
        ...(node.bus ?? []),
        ...(node.underground ?? []),
        ...(node.river ?? []),
      ])
    );
  } else if (transport === 'river') {
    if (!isCulprit) return [];
    candidates = node.river ?? [];
  } else {
    candidates = node[transport] ?? [];
  }

  if (isCulprit) return candidates;

  const others = new Set(
    ctx.players
      .filter((p) => p.role !== 'culprit' && p.role !== role)
      .map((p) => p.position)
  );
  return candidates.filter((n) => !others.has(n));
}

/**
 * Did this just-applied move capture Mr. X? Used by clients to recognize end-of-game
 * locally even though the server is authoritative.
 */
export function isCapture(
  move: ProposedMove,
  ctx: ValidationContext
): boolean {
  if (move.role === 'culprit') return false;
  const culprit = ctx.players.find((p) => p.role === 'culprit');
  if (!culprit) return false;
  return move.targetNodeId === culprit.position;
}
