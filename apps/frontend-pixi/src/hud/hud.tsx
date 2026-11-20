import { VehicleKind } from '../three/vehicles';
import type { HoveredInfo } from '../app/game';
import { useGameStateStore } from '../stores/game-state-store';
import { getTheme } from '../core/theme-registry';
import { COLOR, FONT, RADIUS, SHADOW, SCREEN_MARGIN, TRANSPORT_CHIP, type ChipTone } from './tokens';
import { useNarrowViewport } from './use-viewport';

interface HudProps {
  nodeId: number;
  nodeName: string;
  round: number;
  tickets: { taxi: number; bus: number; underground: number };
  hoveredInfo: HoveredInfo | null;
  touch: boolean;
}

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

const TICKET_KINDS = ['taxi', 'bus', 'underground'] as const;

export function Hud({ nodeId, nodeName, round, tickets, hoveredInfo, touch }: HudProps) {
  const themeId = useGameStateStore((s) => s.theme);
  const narrow = useNarrowViewport();
  const theme = getTheme(themeId);
  const labelFor = (kind: VehicleKind): string => theme.transportation[kind];

  return (
    <>
      <div style={topBar}>
        <div style={pill}>
          <span style={pillLabel}>ROUND</span>
          <span style={pillValue}>{round}</span>
        </div>
        <div style={{ ...pill, minWidth: 0 }}>
          {!narrow && <span style={pillLabel}>YOU ARE AT</span>}
          <span style={{ ...pillValue, ...ellipsis }}>{nodeName}</span>
          <span style={pillSub}>#{nodeId}</span>
        </div>
      </div>

      <div style={narrow ? bottomBarNarrow : bottomBar}>
        {TICKET_KINDS.map((kind) => (
          <Ticket
            key={kind}
            label={narrow ? theme.transportationShort[kind] : labelFor(kind)}
            count={tickets[kind]}
            tone={TRANSPORT_CHIP[kind]}
            icon={KIND_ICON[kind]}
            compact={narrow}
          />
        ))}
      </div>

      {hoveredInfo && (
        <div style={actionHint}>
          <div style={{ ...actionTitle, color: TRANSPORT_CHIP[hoveredInfo.kind].color }}>
            {KIND_ICON[hoveredInfo.kind]} {KIND_VERB[hoveredInfo.kind]} {labelFor(hoveredInfo.kind)}
          </div>
          <div style={actionDest}>
            to <strong>{hoveredInfo.destinationName}</strong>
            <span style={destNumber}>· #{hoveredInfo.destinationNodeId}</span>
          </div>
          <div style={actionMeta}>
            uses 1 {hoveredInfo.kind === 'river' ? 'secret' : labelFor(hoveredInfo.kind).toLowerCase()} ticket · {hoveredInfo.ticketsRemaining - 1} left after
          </div>
        </div>
      )}

      {!touch && !narrow && (
        <div style={mapHintStyle}>
          <kbd style={kbdStyle}>TAB</kbd> strategic map while pointer is locked
        </div>
      )}
    </>
  );
}

interface TicketProps {
  label: string;
  count: number;
  tone: ChipTone;
  icon: string;
  compact: boolean;
}

function Ticket({ label, count, tone, icon, compact }: TicketProps) {
  const empty = count <= 0;
  return (
    <div
      style={{
        ...(compact ? ticketCardCompact : ticketCard),
        borderColor: empty ? COLOR.hairline : tone.border,
        opacity: empty ? 0.7 : 1,
      }}
    >
      <div style={{ ...(compact ? ticketIconCompact : ticketIcon), color: tone.color }}>{icon}</div>
      <div style={ticketBody}>
        <div style={{ ...ticketLabel, ...ellipsis }}>{label}</div>
        <div style={{ ...ticketCount, color: empty ? COLOR.fg2 : COLOR.fg }}>×{count}</div>
      </div>
    </div>
  );
}

const ellipsis: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const PANEL_GLASS = 'rgba(23, 25, 30, 0.82)';

const topBar: React.CSSProperties = {
  position: 'fixed',
  top: 108,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 8,
  maxWidth: `calc(100vw - ${SCREEN_MARGIN * 2}px)`,
  zIndex: 5,
  pointerEvents: 'none',
};

const pill: React.CSSProperties = {
  background: PANEL_GLASS,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.control,
  padding: '6px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  font: `600 11px ${FONT.ui}`,
  letterSpacing: '.12em',
  color: COLOR.fg,
  whiteSpace: 'nowrap',
  backdropFilter: 'blur(6px)',
};

const pillLabel: React.CSSProperties = {
  color: COLOR.fg2,
};

const pillValue: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 0,
};

const pillSub: React.CSSProperties = {
  font: `500 11px ${FONT.mono}`,
  letterSpacing: 0,
  color: COLOR.fg2,
};

const bottomBar: React.CSSProperties = {
  position: 'fixed',
  bottom: 22,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 12,
  zIndex: 5,
  pointerEvents: 'none',
};

// Phone: full-width row lifted above the bottom-corner controls (graphics toggle, system bar).
const bottomBarNarrow: React.CSSProperties = {
  ...bottomBar,
  bottom: 64,
  left: SCREEN_MARGIN,
  right: SCREEN_MARGIN,
  transform: 'none',
  gap: 8,
};

const ticketCard: React.CSSProperties = {
  background: PANEL_GLASS,
  border: '1px solid',
  borderRadius: RADIUS.card,
  padding: '10px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 130,
  boxShadow: SHADOW.pillDark,
  backdropFilter: 'blur(8px)',
};

const ticketCardCompact: React.CSSProperties = {
  ...ticketCard,
  flex: '1 1 0',
  minWidth: 0,
  padding: '8px 10px',
  gap: 8,
};

const ticketIcon: React.CSSProperties = {
  fontSize: 26,
  width: 32,
  textAlign: 'center',
  flexShrink: 0,
};

const ticketIconCompact: React.CSSProperties = {
  ...ticketIcon,
  fontSize: 20,
  width: 24,
};

const ticketBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  lineHeight: 1.15,
  minWidth: 0,
};

const ticketLabel: React.CSSProperties = {
  color: COLOR.fg2,
  font: `600 11px ${FONT.ui}`,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
};

const ticketCount: React.CSSProperties = {
  font: `600 19px ${FONT.mono}`,
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
  borderRadius: RADIUS.tag,
  fontSize: 11,
  fontFamily: FONT.mono,
  fontWeight: 600,
  letterSpacing: 1,
};
