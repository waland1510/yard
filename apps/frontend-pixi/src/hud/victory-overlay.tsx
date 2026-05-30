// Full-screen game-end overlay. Themed confetti, winner announcement, replay/restart
// buttons. Mounts only when game-state-store.status === 'finished'.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme, characterFor } from '../core/theme-registry';
import type { RoleType } from '@yard/shared-utils';
import { ROLE_PALETTE } from '../core/map-data';
import { replay, useReplay } from '../core/replay-singleton';

export function VictoryOverlay() {
  const status = useGameStateStore((s) => s.status);
  const currentTurn = useGameStateStore((s) => s.currentTurn);
  const themeId = useGameStateStore((s) => s.theme);
  const myRole = useRunnerStore((s) => s.myRole);
  const replayView = useReplay();
  const navigate = useNavigate();
  const theme = getTheme(themeId);

  // Generate confetti once
  const confetti = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: (i * 53 + 17) % 100,
      delay: ((i * 31) % 500) / 1000,
      duration: 2 + ((i * 19) % 200) / 100,
      size: 6 + ((i * 7) % 9),
      color: theme.palette.confetti[i % theme.palette.confetti.length],
      drift: ((i * 41) % 400 - 200) / 10,
      rotation: ((i * 73) % 720) - 360,
    }));
  }, [theme]);

  if (status !== 'finished') return null;
  if (replayView.isActive) return null; // hidden while user is watching the replay

  // Winner = the role that holds currentTurn at game-end
  const winner = currentTurn as RoleType;
  const winnerIsCulprit = winner === 'culprit';
  const youWon = winner === myRole || (!winnerIsCulprit && myRole !== 'culprit') || (winnerIsCulprit && myRole === 'culprit');
  const character = characterFor(theme, winner);

  return (
    <div style={backdrop}>
      <div style={confettiLayer}>
        {confetti.map((c) => (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              top: -20,
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 1.6,
              background: c.color,
              animation: `sy-confetti-fall ${c.duration}s ${c.delay}s ease-in forwards`,
              transform: `translateX(${c.drift}vw) rotate(${c.rotation}deg)`,
              borderRadius: 2,
            }}
          />
        ))}
      </div>

      <div style={card}>
        <div style={{ ...resultLabel, color: youWon ? theme.palette.accent : 'rgba(255,255,255,0.55)' }}>
          {youWon ? 'VICTORY' : 'DEFEAT'}
        </div>

        <img
          src={character.image}
          alt={character.name}
          style={{
            ...avatar,
            borderColor: ROLE_PALETTE[winner as keyof typeof ROLE_PALETTE] ?? theme.palette.accent,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />

        <div style={winnerLine}>{character.name} wins</div>
        <div style={subtitle}>
          {winnerIsCulprit
            ? `${character.name} escaped the city`
            : 'The detectives caught Mr. X'}
        </div>

        <div style={buttonRow}>
          <button style={primaryButton(theme.palette.accent)} onClick={() => navigate('/')}>
            Play Again
          </button>
          {replayView.totalTurns > 0 && (
            <button
              style={ghostButton}
              onClick={() => replay.enter()}
            >
              View Replay
            </button>
          )}
          <button style={ghostButton} onClick={() => navigate('/')}>
            Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(5, 6, 10, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 30,
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  backdropFilter: 'blur(6px)',
  overflow: 'hidden',
};

const confettiLayer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
};

const card: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '40px 60px',
  background: 'rgba(15, 18, 24, 0.92)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 16,
  textAlign: 'center',
  boxShadow: '0 20px 80px rgba(0,0,0,0.7)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  minWidth: 360,
};

const resultLabel: React.CSSProperties = {
  fontSize: 48,
  fontWeight: 900,
  letterSpacing: 8,
  textShadow: '0 4px 24px rgba(0,0,0,0.6)',
};

const avatar: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: '50%',
  border: '3px solid',
  objectFit: 'cover',
  background: '#1a1a1a',
  marginTop: 12,
};

const winnerLine: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  marginTop: 8,
};

const subtitle: React.CSSProperties = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.6)',
  fontStyle: 'italic',
};

const buttonRow: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 24,
};

function primaryButton(accent: string): React.CSSProperties {
  return {
    padding: '12px 28px',
    background: accent,
    border: 'none',
    borderRadius: 8,
    color: '#0a0a0a',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 2,
    cursor: 'pointer',
    textTransform: 'uppercase',
    fontFamily: 'inherit',
  };
}

const ghostButton: React.CSSProperties = {
  padding: '12px 20px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.8)',
  fontSize: 13,
  letterSpacing: 1.5,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textTransform: 'uppercase',
};
