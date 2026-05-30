// Strategic-map overlay shell. Used to render its own SVG of London; now serves
// as a full-screen modal that hosts <MapView/> inside its content area. When the
// user clicks a connection in the embedded map, PaperMap auto-closes BEFORE the
// parent's click handler fires so the ride animation can play uninterrupted on
// the FPV canvas behind.

import { useCallback } from 'react';
import type { Player, RoleType } from '@yard/shared-utils';
import type { Connection, TransportKind } from '../game/connections';
import { MapView } from './map-view';

interface PaperMapProps {
  currentNodeId: number;
  connections: readonly Connection[];
  isMyTurn: boolean;
  currentTurnRole: string;
  viewerRole: RoleType | null;
  players: readonly Player[];
  culpritMoveCount: number;
  ticketsByKind: Partial<Record<TransportKind, number>>;
  onConnectionClick: (conn: Connection) => void;
  onClose: () => void;
}

const INK = '#241808';
const INK_FADED = 'rgba(36, 24, 8, 0.45)';
const PAPER = '#efe4c9';

export function PaperMap({
  currentNodeId,
  connections,
  isMyTurn,
  currentTurnRole,
  viewerRole,
  players,
  culpritMoveCount,
  ticketsByKind,
  onConnectionClick,
  onClose,
}: PaperMapProps) {
  // Auto-close BEFORE invoking the parent's handler so the ride animation starts
  // on the FPV canvas behind the (now closed) overlay.
  const handleConnectionClick = useCallback(
    (conn: Connection) => {
      onClose();
      onConnectionClick(conn);
    },
    [onClose, onConnectionClick]
  );

  return (
    <div style={backdrop}>
      <div style={header}>
        <div style={title}>STRATEGIC MAP</div>
        <button
          type="button"
          onClick={onClose}
          style={closeBtn}
          aria-label="Close strategic map"
          title="Close (TAB or ESC)"
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>✕</span>
          <kbd style={kbdStyle}>ESC</kbd>
        </button>
      </div>

      <div style={mapHost}>
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
          onConnectionClick={handleConnectionClick}
        />
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.82)',
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  backdropFilter: 'blur(3px)',
};

const header: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 24px',
  background: PAPER,
  borderBottom: `1px solid ${INK_FADED}`,
  boxShadow: '0 4px 18px rgba(0,0,0,0.45)',
  flex: '0 0 auto',
  zIndex: 1,
};

const title: React.CSSProperties = {
  fontFamily: "'Georgia', serif",
  fontSize: 22,
  fontWeight: 800,
  color: INK,
  letterSpacing: 4,
};

const closeBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 12px',
  background: 'transparent',
  border: `1px solid ${INK_FADED}`,
  borderRadius: 6,
  color: INK,
  fontFamily: "'Georgia', serif",
  fontSize: 13,
  cursor: 'pointer',
};

const kbdStyle: React.CSSProperties = {
  padding: '3px 9px',
  background: 'rgba(36, 24, 8, 0.07)',
  border: `1px solid ${INK_FADED}`,
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontWeight: 600,
  letterSpacing: 1,
  color: INK,
};

const mapHost: React.CSSProperties = {
  position: 'relative',
  flex: '1 1 auto',
  minHeight: 0,
  overflow: 'hidden',
};
