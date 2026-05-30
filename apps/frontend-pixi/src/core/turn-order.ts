// Deriving currentTurn from the move log. The backend computes turn-advancement on
// each makeMove broadcast but does NOT persist the new currentTurn back to the database,
// so after a refresh the REST GET returns the stale initial value. We rebuild the
// canonical turn from the moves array using the same getNextRole rule.

import { getNextRole, type Move, type RoleType } from '@yard/shared-utils';

export function deriveCurrentTurn(moves: Move[]): RoleType {
  let turn: RoleType = 'culprit';
  for (const move of moves) {
    // Skip orphan moves whose role doesn't match the current turn — happens in pathological
    // states; we'd rather not crash.
    if (move.role && move.role !== turn) continue;
    turn = getNextRole(turn, !!move.double);
  }
  return turn;
}
