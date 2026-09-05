// Animated "Your turn" slide-in banner. Triggers when currentTurn transitions to the
// local viewer's role. Auto-dismisses after 1.6s. Doesn't show if the game is finished
// or if the local player is impersonating someone else.

import { useEffect, useRef, useState } from 'react';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme } from '../core/theme-registry';
import { play as playSfx } from '../core/audio-bus';
import { COLOR, FONT, MOTION, RADIUS, SHADOW, centeredX } from './tokens';

const HOLD_MS = 1600;

export function TurnBanner() {
  const currentTurn = useGameStateStore((s) => s.currentTurn);
  const status = useGameStateStore((s) => s.status);
  const themeId = useGameStateStore((s) => s.theme);
  const myRole = useRunnerStore((s) => s.myRole);
  const viewingAs = useRunnerStore((s) => s.viewingAs);
  const theme = getTheme(themeId);

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('Your turn');
  const lastTurnRef = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === 'finished') return;
    if (lastTurnRef.current === currentTurn) return;
    lastTurnRef.current = currentTurn;

    const viewer = viewingAs ?? myRole;
    if (!viewer) return;

    if (currentTurn === viewer) {
      setMessage(viewer === 'culprit' ? `${theme.characters.culprit.name}'s turn` : 'Your turn');
      setVisible(true);
      playSfx('turn-banner');
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), HOLD_MS);
    } else {
      setVisible(false);
    }
  }, [currentTurn, myRole, viewingAs, status, theme]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div
      style={{
        ...container,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, -40px)',
        transition: `opacity 240ms ease, transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1.4), left ${MOTION}`,
      }}
      aria-hidden={!visible}
    >
      <div style={{ ...inner, borderColor: theme.palette.accent }}>
        <span style={{ ...title, color: theme.palette.accent }}>{message}</span>
      </div>
    </div>
  );
}

const container: React.CSSProperties = {
  position: 'fixed',
  top: 118,
  ...centeredX(),
  zIndex: 12,
  pointerEvents: 'none',
};

const inner: React.CSSProperties = {
  padding: '12px 28px',
  background: COLOR.panel,
  border: '1.5px solid',
  borderRadius: RADIUS.pill,
  boxShadow: SHADOW.dock,
};

const title: React.CSSProperties = {
  font: `800 16px ${FONT.ui}`,
  letterSpacing: '.18em',
  textTransform: 'uppercase',
};
