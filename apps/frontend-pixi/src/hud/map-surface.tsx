// The strategic map as a PRIMARY full-screen surface (the desktop default, #2). It owns the
// whole viewport. The surface button in TopPills switches back to street view.

import type { Player, RoleType } from '@yard/shared-utils';
import type { Connection } from '../game/connections';
import type { MoveTicketInventory } from '../core/move-validator';
import { MapView } from './map-view';

interface MapSurfaceProps {
  currentNodeId: number;
  connections: readonly Connection[];
  isMyTurn: boolean;
  currentTurnRole: string;
  viewerRole: RoleType | null;
  players: readonly Player[];
  culpritMoveCount: number;
  tickets: MoveTicketInventory;
  secretArmed: boolean;
  /** Hide the map (keeping it mounted) so the FPV ride cinematic shows through. */
  hidden?: boolean;
  /** Post-game replay (#11). */
  isReplay?: boolean;
  onConnectionClick: (conn: Connection) => void;
}

export function MapSurface({
  currentNodeId,
  connections,
  isMyTurn,
  currentTurnRole,
  viewerRole,
  players,
  culpritMoveCount,
  tickets,
  secretArmed,
  hidden = false,
  isReplay = false,
  onConnectionClick,
}: MapSurfaceProps) {
  return (
    <div style={hidden ? hostHidden : host}>
      <MapView
        currentNodeId={currentNodeId}
        connections={connections}
        interactive={isMyTurn}
        isMyTurn={isMyTurn}
        currentTurnRole={currentTurnRole}
        viewerRole={viewerRole}
        players={players}
        culpritMoveCount={culpritMoveCount}
        tickets={tickets}
        secretArmed={secretArmed}
        isReplay={isReplay}
        onConnectionClick={onConnectionClick}
      />
    </div>
  );
}

const host: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 5,
  background: '#0b0d12',
};

// During a ride the canvas (z 0) plays the cinematic; hide the map without unmounting
// so Google Maps stays initialized.
const hostHidden: React.CSSProperties = {
  ...host,
  visibility: 'hidden',
  pointerEvents: 'none',
};
