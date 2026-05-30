// Post-game replay UI: scrubber + Prev/Next + Exit + a REPLAY banner at the top.
// Only mounts when the singleton replay-controller is active.

import { replay, useReplay } from '../core/replay-singleton';
import { useGameStateStore } from '../stores/game-state-store';
import { getTheme } from '../core/theme-registry';
import { nodeDisplayName } from '../core/map-data';

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
  top: 18,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(10, 12, 16, 0.92)',
  border: '1px solid rgba(255, 107, 53, 0.5)',
  borderRadius: 8,
  padding: '8px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  zIndex: 13,
  pointerEvents: 'none',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(10, 12, 16, 0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '12px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  zIndex: 13,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
};

function iconButton(disabled: boolean): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
    transition: 'all 160ms ease',
  };
}

const slider: React.CSSProperties = {
  width: 280,
  height: 6,
  cursor: 'pointer',
};

function exitButton(accent: string): React.CSSProperties {
  return {
    marginLeft: 8,
    padding: '8px 16px',
    background: 'transparent',
    border: `1px solid ${accent}`,
    borderRadius: 8,
    color: accent,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.6,
    cursor: 'pointer',
    textTransform: 'uppercase',
    fontFamily: 'inherit',
  };
}
