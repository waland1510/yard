// Right-side collapsible drawer with chronological Mr. X move history across 24 rounds.
// Hidden positions show ??; reveal rounds (3,8,13,18,24) show position with an eye icon.
// Secret moves render as purple "SECRET"; double moves get a small "×2" badge.

import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme } from '../core/theme-registry';
import { SHOW_CULPRIT_AT_MOVES, nodeDisplayName } from '../core/map-data';

const TOTAL_ROUNDS = 24;

export function MovesDrawer() {
  // Always visible in FPV mode — no toggle handle. Same rationale as PlayersDrawer.
  const moves = useGameStateStore((s) => s.moves);
  const status = useGameStateStore((s) => s.status);
  const themeId = useGameStateStore((s) => s.theme);
  const theme = getTheme(themeId);

  // The drawer is a PUBLIC-INFORMATION view of Mr. X's trail. Positions are hidden to
  // everyone (including Mr. X) on non-reveal rounds — Mr. X's own current position is
  // visible elsewhere (HUD + paper map + own avatar). After the game ends, full positions
  // are shown for the post-game review.
  const gameOver = status === 'finished';
  const culpritMoves = moves.filter((m) => m.role === 'culprit');
  const currentRound = culpritMoves.length;

  return (
    <>
      <aside style={{ ...drawer, right: 0 }}>
        <div style={drawerHeader}>
          <h3 style={drawerTitle}>Mr. X's Trail</h3>
          <div style={drawerSub}>Round {Math.max(1, currentRound)} of {TOTAL_ROUNDS}</div>
        </div>
        <div style={list}>
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
            const round = i + 1;
            const move = culpritMoves[i];
            const isReveal = SHOW_CULPRIT_AT_MOVES.includes(round as 3 | 8 | 13 | 18 | 24);
            const isCurrent = round === currentRound;
            const isPast = move != null;
            return (
              <div
                key={round}
                style={row(isReveal, isCurrent, isPast)}
              >
                <div style={roundNumber(isReveal)}>{round}</div>
                <div style={moveBody}>
                  {move ? (
                    <RenderMove
                      type={move.type}
                      position={move.position}
                      secret={move.secret}
                      double={move.double}
                      reveal={isReveal}
                      showPosition={isReveal || gameOver}
                      theme={theme}
                    />
                  ) : (
                    <span style={pendingText}>—</span>
                  )}
                </div>
                {isReveal && <span style={revealMark}>👁</span>}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

function RenderMove({
  type,
  position,
  secret,
  double,
  reveal,
  showPosition,
  theme,
}: {
  type: string;
  position?: number;
  secret?: boolean;
  double?: boolean;
  reveal: boolean;
  showPosition: boolean;
  theme: ReturnType<typeof getTheme>;
}) {
  const transportLabel = secret
    ? theme.transportation.secret
    : type === 'taxi'
    ? theme.transportation.taxi
    : type === 'bus'
    ? theme.transportation.bus
    : type === 'underground'
    ? theme.transportation.underground
    : type === 'river'
    ? theme.transportation.river
    : type;
  const color = secret
    ? '#a06bd8'
    : type === 'taxi'
    ? '#f6c945'
    : type === 'bus'
    ? '#e25555'
    : type === 'underground'
    ? '#5a8dde'
    : type === 'river'
    ? '#6cb8d6'
    : '#999';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ ...transportTag, color, borderColor: color }}>{transportLabel}</span>
      {double && <span style={doubleBadge}>×2</span>}
      <span style={{ ...positionText, color: reveal ? '#ff6b35' : 'rgba(255,255,255,0.85)' }}>
        {showPosition && position != null ? nodeDisplayName(position) : '???'}
      </span>
    </div>
  );
}

const DRAWER_WIDTH = 280;

const drawer: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  width: DRAWER_WIDTH,
  height: '100vh',
  background: 'rgba(10, 12, 16, 0.92)',
  borderLeft: '1px solid rgba(255,255,255,0.08)',
  zIndex: 8,
  padding: '24px 16px',
  display: 'flex',
  flexDirection: 'column',
  transition: 'right 240ms ease',
  backdropFilter: 'blur(8px)',
  boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
};

const handle: React.CSSProperties = {
  position: 'fixed',
  top: 100,
  background: 'rgba(10, 12, 16, 0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRight: 'none',
  borderRadius: '8px 0 0 8px',
  padding: '12px 8px',
  color: '#fff',
  cursor: 'pointer',
  zIndex: 9,
  transition: 'right 240ms ease',
  fontSize: 13,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  letterSpacing: 1.2,
};

const handleLabel: React.CSSProperties = {
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  fontSize: 10,
  letterSpacing: 1.5,
};

const drawerHeader: React.CSSProperties = {
  paddingBottom: 12,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  marginBottom: 12,
};

const drawerTitle: React.CSSProperties = {
  fontSize: 16,
  letterSpacing: 2.5,
  margin: 0,
  color: '#fff',
};

const drawerSub: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
  marginTop: 2,
  fontStyle: 'italic',
};

const list: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  overflowY: 'auto',
  flex: 1,
};

function row(isReveal: boolean, isCurrent: boolean, isPast: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px',
    background: isCurrent
      ? 'rgba(255, 107, 53, 0.18)'
      : isPast
      ? 'rgba(255,255,255,0.03)'
      : 'transparent',
    border: `1px solid ${isReveal ? 'rgba(255, 107, 53, 0.6)' : isCurrent ? '#ff6b35' : 'rgba(255,255,255,0.06)'}`,
    borderRadius: 6,
    minHeight: 28,
    color: '#fff',
    fontFamily: 'inherit',
    opacity: isPast ? 1 : 0.4,
    transition: 'all 160ms ease',
  };
}

function roundNumber(isReveal: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    color: isReveal ? '#ff6b35' : 'rgba(255,255,255,0.55)',
    minWidth: 18,
    textAlign: 'center',
    fontFamily: 'ui-monospace, monospace',
  };
}

const moveBody: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 11,
};

const transportTag: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  padding: '2px 6px',
  border: '1px solid',
  borderRadius: 3,
  textTransform: 'uppercase',
};

const doubleBadge: React.CSSProperties = {
  background: '#4e88c2',
  color: '#fff',
  fontSize: 9,
  fontWeight: 800,
  padding: '1px 4px',
  borderRadius: 3,
};

const positionText: React.CSSProperties = {
  fontSize: 11,
  fontStyle: 'italic',
};

const pendingText: React.CSSProperties = {
  color: 'rgba(255,255,255,0.25)',
  fontSize: 12,
};

const revealMark: React.CSSProperties = {
  fontSize: 12,
  color: '#ff6b35',
  filter: 'drop-shadow(0 0 4px #ff6b35aa)',
};
