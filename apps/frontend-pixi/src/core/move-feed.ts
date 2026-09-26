// Turns another player's move or join into a short feed line. Mr. X's position only
// appears on reveal rounds, and a secret ticket hides which transport was used.

import type { Move, RoleType } from '@yard/shared-utils';
import type { NotificationKind } from './notification-service';
import { characterFor, transportLabel, type Theme } from './theme-registry';
import { isRevealRound, nodeDisplayName } from './map-data';
import { culpritMoveCount } from './move-validator';

export interface FeedLine {
  kind: NotificationKind;
  message: string;
}

export function describeMove(
  move: Pick<Move, 'type' | 'position' | 'secret' | 'double'> & { role: RoleType },
  movesIncludingThis: readonly Move[],
  theme: Theme
): FeedLine {
  const who = characterFor(theme, move.role).name;
  const transport = move.secret ? transportLabel(theme, 'secret') : transportLabel(theme, move.type);
  if (move.role !== 'culprit') {
    return { kind: 'info', message: `${who} took the ${transport} to ${nodeDisplayName(move.position)}` };
  }
  const round = culpritMoveCount(movesIncludingThis);
  if (isRevealRound(round)) {
    return { kind: 'reveal', message: `${who} surfaced at ${nodeDisplayName(move.position)} (round ${round})` };
  }
  const double = move.double ? ` and plays a ${transportLabel(theme, 'double')}` : '';
  return { kind: 'info', message: `${who} used the ${transport}${double}` };
}

export function describeJoin(role: RoleType, username: string | undefined, theme: Theme): FeedLine {
  const character = characterFor(theme, role).name;
  const name = username?.trim();
  return { kind: 'info', message: name ? `${name} joined as ${character}` : `${character} joined` };
}
