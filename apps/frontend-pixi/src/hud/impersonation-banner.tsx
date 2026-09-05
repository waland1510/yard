// Top-center banner shown while the local user is impersonating another detective.
// Visible perspective-switch indicator with a single-click "return to your view" button.

import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme, characterFor } from '../core/theme-registry';
import { COLOR, FONT, RADIUS, SHADOW, centeredX } from './tokens';

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
  top: 108,
  ...centeredX(),
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 10px 8px 8px',
  background: COLOR.panel,
  border: `1px solid ${COLOR.blue}`,
  borderRadius: RADIUS.pill,
  zIndex: 11,
  boxShadow: SHADOW.dock,
  color: COLOR.fg,
  fontFamily: FONT.ui,
};

const avatar: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: `2px solid ${COLOR.blue}`,
  objectFit: 'cover',
  background: COLOR.avatarBg,
};

const text: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  lineHeight: 1.15,
};

const kicker: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 2,
  color: COLOR.blueTint,
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
  padding: '7px 14px',
  background: COLOR.blue,
  border: 0,
  borderRadius: RADIUS.pill,
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.4,
  cursor: 'pointer',
  textTransform: 'uppercase',
  fontFamily: 'inherit',
};
