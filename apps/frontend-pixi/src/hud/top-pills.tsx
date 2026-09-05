// Floating top cluster over the free map area: a light segmented control (turn status +
// surface switch) and the Mr. X reveal countdown pill. Hidden during replay, which has its
// own banner. Re-centres with the dock via `--hud-shift`.

import { useMemo } from 'react';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore, selectActiveSurface } from '../stores/runner-store';
import { getTheme, characterFor } from '../core/theme-registry';
import { SHOW_CULPRIT_AT_MOVES, isRevealRound } from '../core/map-data';
import { culpritMoveCount } from '../core/move-validator';
import { useReplay } from '../core/replay-singleton';
import { COLOR, FONT, RADIUS, SHADOW, SCREEN_MARGIN, centeredX } from './tokens';

export function TopPills() {
  const currentTurn = useGameStateStore((s) => s.currentTurn);
  const status = useGameStateStore((s) => s.status);
  const moves = useGameStateStore((s) => s.moves);
  const themeId = useGameStateStore((s) => s.theme);
  const myRole = useRunnerStore((s) => s.myRole);
  const viewingAs = useRunnerStore((s) => s.viewingAs);
  const activeSurface = useRunnerStore(selectActiveSurface);
  const toggleSurface = useRunnerStore((s) => s.toggleSurface);
  const replayView = useReplay();
  const theme = getTheme(themeId);

  const viewer = viewingAs ?? myRole;
  const isMyTurn = status === 'active' && viewer != null && currentTurn === viewer;
  const turnLabel = isMyTurn ? 'Your turn' : `${characterFor(theme, currentTurn).name}'s turn`;

  const played = culpritMoveCount(moves);
  const reveal = useMemo(() => {
    if (isRevealRound(played)) return { text: `Mr. X revealed · round ${played}`, hot: true };
    const next = SHOW_CULPRIT_AT_MOVES.find((r) => r > played);
    if (next == null) return null;
    const inN = next - played;
    return { text: `Mr. X reveals in ${inN} ${inN === 1 ? 'round' : 'rounds'}`, hot: inN <= 1 };
  }, [played]);

  if (replayView.isActive) return null;

  const goingToFpv = activeSurface === 'map';

  return (
    <div style={cluster}>
      <div style={segmented}>
        <span style={segment(isMyTurn)}>{status === 'finished' ? 'Game over' : turnLabel}</span>
        <button
          type="button"
          style={{ ...segment(false), cursor: 'pointer' }}
          onClick={toggleSurface}
          aria-label={goingToFpv ? 'Switch to street view' : 'Switch to strategic map'}
        >
          {goingToFpv ? '🚕 Street view' : '🗺️ Strategic map'}
        </button>
      </div>
      {reveal && status === 'active' && (
        <div style={revealPill}>
          <span style={{ ...dot, animation: reveal.hot ? 'sy-blink 1.4s infinite' : undefined }} />
          {reveal.text}
        </div>
      )}
    </div>
  );
}

const cluster: React.CSSProperties = {
  position: 'fixed',
  top: SCREEN_MARGIN,
  ...centeredX(),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  zIndex: 30,
  fontFamily: FONT.ui,
};

const segmented: React.CSSProperties = {
  display: 'flex',
  background: '#fff',
  borderRadius: RADIUS.pill,
  padding: 4,
  gap: 2,
  boxShadow: SHADOW.pillLight,
};

function segment(active: boolean): React.CSSProperties {
  return {
    border: 0,
    background: active ? COLOR.pill : 'transparent',
    color: active ? '#fff' : '#555',
    padding: '8px 18px',
    borderRadius: RADIUS.pill,
    font: `600 14px ${FONT.ui}`,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };
}

const revealPill: React.CSSProperties = {
  background: COLOR.pill,
  color: '#fff',
  borderRadius: RADIUS.pill,
  padding: '7px 16px',
  font: `600 12.5px ${FONT.ui}`,
  boxShadow: '0 2px 10px rgba(0,0,0,.2)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  whiteSpace: 'nowrap',
};

const dot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: COLOR.red,
  flexShrink: 0,
};
