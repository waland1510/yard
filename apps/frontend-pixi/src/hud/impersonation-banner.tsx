// Top-center banner shown while the local user is impersonating another detective.
// Visible perspective-switch indicator with a single-click "return to your view" button.

import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme, characterFor } from '../core/theme-registry';

export function ImpersonationBanner() {
  const myRole = useRunnerStore((s) => s.myRole);
  const viewingAs = useRunnerStore((s) => s.viewingAs);
  const setViewingAs = useRunnerStore((s) => s.setViewingAs);
  const themeId = useGameStateStore((s) => s.theme);
  const theme = getTheme(themeId);

  if (!viewingAs || !myRole || viewingAs === myRole) return null;

  const character = characterFor(theme, viewingAs);
  const roleLabel = `Detective ${viewingAs.replace('detective', '')}`;

  return (
    <div style={container}>
      <img
        src={character.image}
        alt={character.name}
        style={avatar}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />
      <div style={text}>
        <div style={kicker}>PLAYING AS</div>
        <div style={name}>
          {character.name} <span style={subRole}>· {roleLabel}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setViewingAs(myRole)}
        style={returnButton}
      >
        Return to your seat
      </button>
    </div>
  );
}

const container: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px 10px 12px',
  background: 'rgba(94, 141, 222, 0.18)',
  border: '1.5px solid #5a8dde',
  borderRadius: 10,
  zIndex: 11,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const avatar: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '2px solid #5a8dde',
  objectFit: 'cover',
  background: '#1a1a1a',
};

const text: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  lineHeight: 1.15,
};

const kicker: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 2,
  color: '#5a8dde',
  fontWeight: 700,
};

const name: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
};

const subRole: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 12,
};

const returnButton: React.CSSProperties = {
  marginLeft: 6,
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid #5a8dde',
  borderRadius: 6,
  color: '#5a8dde',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.4,
  cursor: 'pointer',
  textTransform: 'uppercase',
  fontFamily: 'inherit',
};
