// Animated "Your turn" slide-in banner. Triggers when currentTurn transitions to the
// local viewer's role. Auto-dismisses after 1.6s. Doesn't show if the game is finished
// or if the local player is impersonating someone else.

import { useEffect, useRef, useState } from 'react';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme } from '../core/theme-registry';
import { play as playSfx } from '../core/audio-bus';

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
  top: 80,
  left: '50%',
  transform: 'translate(-50%, -40px)',
  zIndex: 12,
  pointerEvents: 'none',
  transition: 'opacity 240ms ease, transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1.4)',
};

const inner: React.CSSProperties = {
  padding: '14px 32px',
  background: 'rgba(10, 12, 16, 0.85)',
  border: '2px solid',
  borderRadius: 8,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 10px 40px rgba(0,0,0,0.6), 0 0 24px rgba(255, 107, 53, 0.2)',
};

const title: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: 4,
  textTransform: 'uppercase',
};
