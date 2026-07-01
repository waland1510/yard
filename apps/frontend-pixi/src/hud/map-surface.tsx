// The strategic map as a PRIMARY full-screen surface (the desktop default, #2).
// Unlike <PaperMap/> — which is a dismissable modal peek over the FPV — this owns the
// whole viewport. Switching back to street view is done via the <SurfaceToggle/>, so
// there is no close button or backdrop here.

import type { Player, RoleType } from '@yard/shared-utils';
import type { Connection, TransportKind } from '../game/connections';
import { MapView } from './map-view';

interface MapSurfaceProps {
  currentNodeId: number;
  connections: readonly Connection[];
  isMyTurn: boolean;
  currentTurnRole: string;
  viewerRole: RoleType | null;
  players: readonly Player[];
  culpritMoveCount: number;
  ticketsByKind: Partial<Record<TransportKind, number>>;
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
  ticketsByKind,
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
        ticketsByKind={ticketsByKind}
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
