// Post-game replay UI: scrubber + Prev/Next + Exit + a REPLAY banner at the top.
// Only mounts when the singleton replay-controller is active.

import { replay, useReplay } from '../core/replay-singleton';
import { useGameStateStore } from '../stores/game-state-store';
import { getTheme } from '../core/theme-registry';
import { nodeDisplayName } from '../core/map-data';
import { COLOR, FONT, RADIUS, SCREEN_MARGIN, SHADOW, centeredX, pillDark } from './tokens';

export function ReplayControls() {
  const { isActive, currentTurn, totalTurns, culpritActualPosition } = useReplay();
  const themeId = useGameStateStore((s) => s.theme);
  const theme = getTheme(themeId);

  if (!isActive) return null;

  const atStart = currentTurn <= 0;
  const atEnd = currentTurn >= totalTurns - 1;

  return (
    <>
      {/* Top REPLAY banner */}
      <div style={banner}>
        <span style={{ ...bannerDot, background: theme.palette.accent }} />
        <span style={bannerText}>REPLAY</span>
        <span style={bannerMeta}>
          Round {currentTurn + 1} / {totalTurns}
          {culpritActualPosition != null && (
            <>
              {' · '}
              <strong style={{ color: theme.palette.accent }}>
                Mr. X at {nodeDisplayName(culpritActualPosition)}
              </strong>
            </>
          )}
        </span>
      </div>

      {/* Bottom scrubber */}
      <div style={controls}>
        <button
          style={iconButton(atStart)}
          onClick={() => replay.prev()}
          disabled={atStart}
          title="Previous round"
        >
          ◀
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalTurns - 1)}
          step={1}
          value={currentTurn}
          onChange={(e) => replay.seek(Number(e.target.value))}
          style={{ ...slider, accentColor: theme.palette.accent }}
        />
        <button
          style={iconButton(atEnd)}
          onClick={() => replay.next()}
          disabled={atEnd}
          title="Next round"
        >
          ▶
        </button>
        <button style={exitButton(theme.palette.accent)} onClick={() => replay.exit()}>
          Exit Replay
        </button>
      </div>
    </>
  );
}

const banner: React.CSSProperties = {
  position: 'fixed',
  top: SCREEN_MARGIN,
  ...centeredX(),
  background: COLOR.pill,
  borderRadius: RADIUS.pill,
  padding: '9px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  zIndex: 13,
  pointerEvents: 'none',
  boxShadow: SHADOW.pillDark,
  color: '#fff',
  fontFamily: FONT.ui,
  whiteSpace: 'nowrap',
};

const bannerDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  boxShadow: '0 0 12px currentColor',
  animation: 'sy-spin 2s linear infinite',
};

const bannerText: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 4,
  fontWeight: 800,
};

const bannerMeta: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.7)',
  letterSpacing: 0.5,
};

const controls: React.CSSProperties = {
  position: 'fixed',
  bottom: SCREEN_MARGIN,
  ...centeredX(),
  background: COLOR.panel,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.pill,
  padding: '10px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  zIndex: 13,
  boxShadow: SHADOW.dock,
};

function iconButton(disabled: boolean): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    border: 0,
    borderRadius: '50%',
    background: COLOR.pill,
    color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
  };
}

const slider: React.CSSProperties = {
  width: 280,
  height: 6,
  cursor: 'pointer',
};

function exitButton(accent: string): React.CSSProperties {
  return {
    ...pillDark,
    marginLeft: 4,
    padding: '10px 18px',
    background: accent,
    color: COLOR.onGold,
    font: `700 12px ${FONT.ui}`,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
  };
}
