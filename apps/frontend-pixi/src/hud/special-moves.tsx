// Mr. X-only Secret + Double toggles. Sits above the ticket bar. Each button arms its
// flag for the NEXT vehicle click. Auto-clear on commit. Disabled when no ticket or when
// it's not Mr. X's turn (or local viewer isn't Mr. X).

import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme } from '../core/theme-registry';
import { play as playSfx } from '../core/audio-bus';
import { selectActiveSurface } from '../stores/runner-store';
import { COLOR, FONT, SCREEN_MARGIN, centeredX, pillDark } from './tokens';

const SECRET_COLOR = '#c9a0e8';
const DOUBLE_COLOR = '#8db8e8';

export function SpecialMoves() {
  const myRole = useRunnerStore((s) => s.myRole);
  const players = useGameStateStore((s) => s.players);
  const currentTurn = useGameStateStore((s) => s.currentTurn);
  const status = useGameStateStore((s) => s.status);
  const isDoubleMove = useGameStateStore((s) => s.isDoubleMove);
  const themeId = useGameStateStore((s) => s.theme);
  const pendingSecret = useRunnerStore((s) => s.pendingSecret);
  const pendingDouble = useRunnerStore((s) => s.pendingDouble);
  const setPendingSecret = useRunnerStore((s) => s.setPendingSecret);
  const setPendingDouble = useRunnerStore((s) => s.setPendingDouble);
  const onMap = useRunnerStore(selectActiveSurface) === 'map';

  if (myRole !== 'culprit') return null;
  if (status === 'finished') return null;

  const me = players.find((p) => p.role === 'culprit');
  const secretTickets = me?.secretTickets ?? 0;
  const doubleTickets = me?.doubleTickets ?? 0;
  const isMyTurn = currentTurn === 'culprit';

  const theme = getTheme(themeId);

  const secretDisabled = !isMyTurn || secretTickets <= 0;
  // Once you've already committed leg 1 of a double, the double button is locked in
  // (you can't toggle off mid-double). Visually we show it as still armed for leg 2.
  const doubleDisabled = !isMyTurn || isDoubleMove || (doubleTickets <= 0 && !pendingDouble);

  return (
    <div style={{ ...container, bottom: onMap ? SCREEN_MARGIN : 92 }}>
      <button
        type="button"
        className={pendingSecret ? 'hud-pill-gold' : 'hud-pill-dark'}
        style={toggleButton(pendingSecret, SECRET_COLOR, secretDisabled)}
        disabled={secretDisabled}
        onClick={() => {
          const next = !pendingSecret;
          setPendingSecret(next);
          if (next) playSfx('secret-armed');
        }}
        title="Hide which transport you used this move"
      >
        <span style={iconStyle}>🎭</span>
        <span style={labelStyle}>{theme.transportation.secret}</span>
        <span style={countStyle(secretDisabled)}>×{secretTickets}</span>
        {pendingSecret && <span style={armedDot(SECRET_COLOR)}>●</span>}
      </button>
      <button
        type="button"
        className={pendingDouble || isDoubleMove ? 'hud-pill-gold' : 'hud-pill-dark'}
        style={toggleButton(pendingDouble || isDoubleMove, DOUBLE_COLOR, doubleDisabled)}
        disabled={doubleDisabled}
        onClick={() => {
          const next = !pendingDouble;
          setPendingDouble(next);
          if (next) playSfx('double-armed');
        }}
        title="Make two moves in a row this turn"
      >
        <span style={iconStyle}>⏱️</span>
        <span style={labelStyle}>{theme.transportation.double}</span>
        <span style={countStyle(doubleDisabled)}>×{doubleTickets}</span>
        {(pendingDouble || isDoubleMove) && <span style={armedDot(DOUBLE_COLOR)}>●</span>}
      </button>
      {isDoubleMove && (
        <div style={midDoubleHint}>
          Make your second move
        </div>
      )}
    </div>
  );
}

const container: React.CSSProperties = {
  position: 'fixed',
  ...centeredX(),
  display: 'flex',
  gap: 10,
  zIndex: 30,
  pointerEvents: 'auto',
  transition: `left .28s cubic-bezier(.5,0,.2,1), bottom .28s cubic-bezier(.5,0,.2,1)`,
};

function toggleButton(active: boolean, color: string, disabled: boolean): React.CSSProperties {
  return {
    ...pillDark,
    position: 'relative',
    background: active ? COLOR.gold : COLOR.pill,
    color: active ? COLOR.onGold : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    boxShadow: active ? `0 3px 18px ${color}55` : pillDark.boxShadow,
  };
}

const iconStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1,
};

const labelStyle: React.CSSProperties = {};

function countStyle(dim: boolean): React.CSSProperties {
  return {
    font: `600 12px ${FONT.mono}`,
    color: dim ? 'rgba(255,255,255,0.45)' : 'inherit',
    opacity: dim ? 1 : 0.85,
  };
}

function armedDot(color: string): React.CSSProperties {
  return {
    position: 'absolute',
    top: -3,
    right: 2,
    color,
    fontSize: 14,
    textShadow: `0 0 8px ${color}`,
  };
}

const midDoubleHint: React.CSSProperties = {
  position: 'absolute',
  top: -26,
  left: '50%',
  transform: 'translateX(-50%)',
  whiteSpace: 'nowrap',
  fontSize: 11,
  letterSpacing: 1.4,
  color: DOUBLE_COLOR,
  textTransform: 'uppercase',
  fontWeight: 700,
  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
};
