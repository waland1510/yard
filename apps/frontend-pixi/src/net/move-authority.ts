// Move-authority arbitration (#7). When a player drives two paired devices (an fpv-companion
// phone + a map-primary desktop), exactly ONE of them may commit a move for their shared
// role — otherwise the two race on `pendingMove` (last-write-wins) and double-submit.
//
// The decision is pure and unit-testable. Default committer is the FPV controller (the phone,
// where you act in the immersive view); the desktop observes but can take over via
// `delegateTo` (e.g. the phone died). A solo / unpaired device, or a survivor after its peer
// drops, is always its own committer.

import type { CompanionSurface } from '@yard/shared-utils';
import type { RoleType } from '@yard/shared-utils';

export interface AuthorityInput {
  /** This device's stable client id. */
  myClientId: string;
  /** This device's paired surface, or null when solo/unpaired. */
  mySurface: CompanionSurface | null;
  /** Whether the paired peer is currently connected. */
  peerPresent: boolean;
  /** The role this player holds. */
  myRole: RoleType;
  /** Whose turn it currently is. */
  currentTurn: RoleType;
}

export class MoveAuthority {
  /** Explicit committer override (set on both devices when the server delegates). */
  private delegatedTo: string | null = null;

  /** Hand commit authority to a specific client id (or clear with null). */
  delegateTo(clientId: string | null): void {
    this.delegatedTo = clientId;
  }

  /** Whether THIS device may commit a move right now. Pure given the input + delegation. */
  canCommit(input: AuthorityInput): boolean {
    // Never commit out of turn.
    if (input.currentTurn !== input.myRole) return false;
    // Solo, unpaired, or the surviving device after a peer drop → sole committer.
    if (input.mySurface == null || !input.peerPresent) return true;
    // An explicit delegation wins over the default.
    if (this.delegatedTo != null) return this.delegatedTo === input.myClientId;
    // Default: the FPV controller commits; the map viewer observes.
    return input.mySurface === 'fpv-companion';
  }
}
