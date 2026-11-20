// Floating top cluster over the free map area: a light segmented control (turn status +
// surface switch) and the Mr. X reveal countdown pill. Hidden during replay, which has its
// own banner. Re-centres with the dock via `--hud-shift`.

import { useMemo } from 'react';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore, selectActiveSurface } from '../stores/runner-store';
import { getTheme, characterFor } from '../core/theme-registry';
import { isRevealRound, movesUntilReveal } from '../core/map-data';
import { culpritMoveCount } from '../core/move-validator';
import { useReplay } from '../core/replay-singleton';
import { COLOR, FONT, PLAYER_COLOR, RADIUS, SHADOW, SCREEN_MARGIN, TAP, centeredX } from './tokens';

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
    const inN = movesUntilReveal(played);
    if (inN == null) return null;
    return { text: `Mr. X reveals in ${inN} ${inN === 1 ? 'round' : 'rounds'}`, hot: inN <= 1 };
  }, [played]);

  if (replayView.isActive) return null;

  const goingToFpv = activeSurface === 'map';

  return (
    <div className="hud-top-pills" style={cluster}>
      <div style={segmented}>
        <span className="hud-turn" style={turnSegment(isMyTurn)} role="status">
          {!isMyTurn && status !== 'finished' && (
            <span style={{ ...turnDot, background: PLAYER_COLOR[currentTurn] ?? COLOR.fg2 }} aria-hidden />
          )}
          <span className="hud-turn-label">{status === 'finished' ? 'Game over' : turnLabel}</span>
        </span>
        <button
          type="button"
          className="hud-segment"
          style={switchSegment}
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
  maxWidth: 'calc(100vw - var(--dock-w, 0px) - 32px)',
};

const segmented: React.CSSProperties = {
  display: 'flex',
  maxWidth: '100%',
  background: COLOR.panel,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.pill,
  padding: 4,
  gap: 4,
  boxShadow: SHADOW.dock,
};

const segmentBase: React.CSSProperties = {
  border: 0,
  minHeight: `calc(${TAP} - 4px)`,
  padding: '0 var(--hud-segment-padding, 16px)',
  borderRadius: RADIUS.pill,
  font: `600 var(--hud-segment-font-size, 14px) ${FONT.ui}`,
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
};

function turnSegment(mine: boolean): React.CSSProperties {
  return {
    ...segmentBase,
    minWidth: 0,
    background: mine ? COLOR.gold : 'transparent',
    color: mine ? COLOR.onGold : COLOR.fg,
    fontWeight: mine ? 700 : 600,
  };
}

const turnDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  flexShrink: 0,
};

const switchSegment: React.CSSProperties = {
  ...segmentBase,
  flexShrink: 0,
  background: COLOR.pill,
  color: COLOR.fg,
  cursor: 'pointer',
};

const revealPill: React.CSSProperties = {
  background: COLOR.panel,
  border: `1px solid ${COLOR.hairline}`,
  color: COLOR.fg,
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
