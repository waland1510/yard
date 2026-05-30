import { VehicleKind } from '../three/vehicles';
import type { HoveredInfo } from '../app/game';
import { useGameStateStore } from '../stores/game-state-store';
import { getTheme } from '../core/theme-registry';

interface HudProps {
  nodeId: number;
  nodeName: string;
  round: number;
  tickets: { taxi: number; bus: number; underground: number };
  hoveredInfo: HoveredInfo | null;
  mapHint: boolean;
}

const KIND_COLOR: Record<VehicleKind, string> = {
  taxi: '#f6c945',
  bus: '#e25555',
  underground: '#5a8dde',
  river: '#6cb8d6',
};

const KIND_ICON: Record<VehicleKind, string> = {
  taxi: '🚖',
  bus: '🚌',
  underground: 'Ⓤ',
  river: '⛴️',
};

const KIND_VERB: Record<VehicleKind, string> = {
  taxi: 'Take',
  bus: 'Board',
  underground: 'Descend into',
  river: 'Board',
};

export function Hud({ nodeId, nodeName, round, tickets, hoveredInfo, mapHint }: HudProps) {
  const themeId = useGameStateStore((s) => s.theme);
  const theme = getTheme(themeId);
  const labelFor = (kind: VehicleKind): string => theme.transportation[kind];

  return (
    <>
      <div style={topBar}>
        <div style={pill}>
          <span style={pillLabel}>ROUND</span>
          <span style={pillValue}>{round}</span>
        </div>
        <div style={{ ...pill, marginLeft: 12 }}>
          <span style={pillLabel}>YOU ARE AT</span>
          <span style={pillValue}>{nodeName}</span>
          <span style={pillSub}>#{nodeId}</span>
        </div>
      </div>

      <div style={bottomBar}>
        <Ticket label={labelFor('taxi')} count={tickets.taxi} color="#f6c945" icon="🚖" />
        <Ticket label={labelFor('bus')} count={tickets.bus} color="#e25555" icon="🚌" />
        <Ticket label={labelFor('underground')} count={tickets.underground} color="#5a8dde" icon="Ⓤ" />
      </div>

      {hoveredInfo && (
        <div style={actionHint}>
          <div style={{ ...actionTitle, color: KIND_COLOR[hoveredInfo.kind] }}>
            {KIND_ICON[hoveredInfo.kind]} {KIND_VERB[hoveredInfo.kind]} {labelFor(hoveredInfo.kind)}
          </div>
          <div style={actionDest}>
            to <strong>{hoveredInfo.destinationName}</strong>
            <span style={destNumber}>· #{hoveredInfo.destinationNodeId}</span>
          </div>
          <div style={actionMeta}>
            uses 1 {labelFor(hoveredInfo.kind).toLowerCase()} ticket · {hoveredInfo.ticketsRemaining - 1} left after
          </div>
        </div>
      )}

      {mapHint && (
        <div style={mapHintStyle}>
          <kbd style={kbdStyle}>TAB</kbd> open map
        </div>
      )}
    </>
  );
}

function Ticket({ label, count, color, icon }: { label: string; count: number; color: string; icon: string }) {
  const empty = count <= 0;
  return (
    <div
      style={{
        ...ticketCard,
        borderColor: empty ? 'rgba(255,255,255,0.12)' : color,
        opacity: empty ? 0.45 : 1,
      }}
    >
      <div style={{ ...ticketIcon, color }}>{icon}</div>
      <div style={ticketBody}>
        <div style={ticketLabel}>{label}</div>
        <div style={{ ...ticketCount, color: empty ? '#888' : '#fff' }}>×{count}</div>
      </div>
    </div>
  );
}

const topBar: React.CSSProperties = {
  position: 'fixed',
  top: 18,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  zIndex: 5,
  pointerEvents: 'none',
};

const pill: React.CSSProperties = {
  background: 'rgba(12, 14, 18, 0.72)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '6px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  letterSpacing: 1.4,
  color: '#fff',
  backdropFilter: 'blur(6px)',
};

const pillLabel: React.CSSProperties = {
  color: 'rgba(255,255,255,0.55)',
  fontWeight: 600,
};

const pillValue: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
};

const pillSub: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
  fontWeight: 500,
};

const bottomBar: React.CSSProperties = {
  position: 'fixed',
  bottom: 22,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 14,
  zIndex: 5,
  pointerEvents: 'none',
};

const ticketCard: React.CSSProperties = {
  background: 'rgba(10, 12, 16, 0.78)',
  border: '1px solid',
  borderRadius: 12,
  padding: '10px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 130,
  backdropFilter: 'blur(8px)',
};

const ticketIcon: React.CSSProperties = {
  fontSize: 26,
  width: 32,
  textAlign: 'center',
};

const ticketBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  lineHeight: 1.1,
};

const ticketLabel: React.CSSProperties = {
  color: 'rgba(255,255,255,0.6)',
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  fontWeight: 600,
};

const ticketCount: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
};

const actionHint: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, 38px)',
  textAlign: 'center',
  pointerEvents: 'none',
  zIndex: 5,
  textShadow: '0 2px 10px rgba(0,0,0,0.9)',
};

const actionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 1.5,
};

const actionDest: React.CSSProperties = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.95)',
  marginTop: 6,
  letterSpacing: 0.5,
};

const destNumber: React.CSSProperties = {
  marginLeft: 6,
  color: 'rgba(255,255,255,0.55)',
  fontSize: 12,
};

const actionMeta: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  letterSpacing: 1.3,
  color: 'rgba(255,255,255,0.6)',
  fontWeight: 500,
  textTransform: 'uppercase',
};

const mapHintStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 72,
  right: 22,
  fontSize: 12,
  color: 'rgba(255,255,255,0.6)',
  letterSpacing: 1.2,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  pointerEvents: 'none',
  zIndex: 5,
  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
};

const kbdStyle: React.CSSProperties = {
  padding: '2px 8px',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontWeight: 600,
  letterSpacing: 1,
};
