// Shown to players who arrive at an invite link without an explicit ?role= in the URL.
// Reads the current player roster from the game-state-store and lets them pick a role
// (greying out any seat that's already... well, all of them are populated by the backend
// once the game's started, but the joiner can still claim a perspective by picking one).
// On confirm, navigates to /game/:channel?role=...&name=...&theme=... so the URL is
// shareable from that point on.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoleType } from '@yard/shared-utils';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme, characterFor } from '../core/theme-registry';
import { ROLE_PALETTE } from '../core/map-data';
import { getPresence } from '../net/rest-client';

const ROLES: readonly RoleType[] = [
  'culprit',
  'detective1',
  'detective2',
  'detective3',
  'detective4',
  'detective5',
];

interface JoinOverlayProps {
  channel: string;
  onJoin: (role: RoleType, name: string) => void;
}

export function JoinOverlay({ channel, onJoin }: JoinOverlayProps) {
  const themeId = useGameStateStore((s) => s.theme);
  const lastUsername = useRunnerStore((s) => s.lastUsername);
  const [role, setRole] = useState<RoleType | null>(null);
  const [name, setName] = useState(lastUsername);
  const [occupied, setOccupied] = useState<Map<string, string>>(new Map());
  const navigate = useNavigate();
  const theme = getTheme(themeId);

  // Fetch presence from the backend so taken seats are visibly disabled.
  useEffect(() => {
    let cancelled = false;
    getPresence(channel).then((p) => {
      if (cancelled || !p) return;
      const map = new Map<string, string>();
      for (const m of p.members) map.set(m.role, m.username);
      setOccupied(map);
    });
    return () => {
      cancelled = true;
    };
  }, [channel]);

  const canJoin = role != null && name.trim().length > 0 && !occupied.has(role);

  const handleJoin = () => {
    if (!canJoin) return;
    const params = new URLSearchParams({ role: role!, name: name.trim(), theme: themeId });
    navigate(`/game/${encodeURIComponent(channel)}?${params.toString()}`, { replace: true });
    onJoin(role!, name.trim());
  };

  return (
    <div style={backdrop}>
      <div style={card}>
        <div style={kicker}>You were invited to channel</div>
        <div style={channelTag}>{channel}</div>

        <div style={{ marginTop: 28, marginBottom: 12, fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
          Pick a role to play as
        </div>
        <div style={roleGrid}>
          {ROLES.map((r) => {
            const isCulprit = r === 'culprit';
            const idx = isCulprit ? -1 : parseInt(r.replace('detective', ''), 10) - 1;
            const character = isCulprit
              ? theme.characters.culprit
              : theme.characters.detectives[idx];
            const color = ROLE_PALETTE[r as keyof typeof ROLE_PALETTE];
            const isSel = role === r;
            const takenBy = occupied.get(r);
            const isTaken = !!takenBy;
            return (
              <button
                key={r}
                style={roleCard(isSel, color, isTaken)}
                onClick={() => !isTaken && setRole(r)}
                disabled={isTaken}
                title={isTaken ? `Taken by ${takenBy || 'another player'}` : undefined}
              >
                <img
                  src={character.image}
                  alt={character.name}
                  style={{
                    ...avatar,
                    borderColor: isSel ? color : 'rgba(255,255,255,0.2)',
                    filter: isTaken ? 'grayscale(0.8)' : undefined,
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                  }}
                />
                <div style={roleName}>{character.name}</div>
                <div style={roleSub}>{isCulprit ? 'Mr. X' : `Detective ${idx + 1}`}</div>
                {isTaken && (
                  <div style={takenBadge}>{takenBy ? `taken · ${takenBy}` : 'taken'}</div>
                )}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={32}
          style={nameInput}
        />

        <button
          style={joinButton(theme.palette.accent, canJoin)}
          disabled={!canJoin}
          onClick={handleJoin}
        >
          Join Game
        </button>
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
  zIndex: 25,
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  backdropFilter: 'blur(6px)',
};

const card: React.CSSProperties = {
  background: 'rgba(15, 18, 24, 0.94)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 16,
  padding: '32px 40px',
  textAlign: 'center',
  boxShadow: '0 20px 80px rgba(0,0,0,0.7)',
  maxWidth: 620,
  width: '90vw',
};

const kicker: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 3,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
};

const channelTag: React.CSSProperties = {
  marginTop: 8,
  fontFamily: 'ui-monospace, "SF Mono", monospace',
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: 4,
  color: '#fff',
};

const roleGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
};

function roleCard(selected: boolean, color: string, taken = false): React.CSSProperties {
  return {
    padding: '16px 8px',
    background: selected ? `${color}22` : 'rgba(255,255,255,0.04)',
    border: `2px solid ${selected ? color : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10,
    cursor: taken ? 'not-allowed' : 'pointer',
    color: '#fff',
    transition: 'all 160ms ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'inherit',
    opacity: taken ? 0.4 : 1,
    position: 'relative',
  };
}

const takenBadge: React.CSSProperties = {
  marginTop: 4,
  fontSize: 9,
  letterSpacing: 1.2,
  color: '#e25555',
  textTransform: 'uppercase',
  fontWeight: 700,
  fontFamily: 'inherit',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const avatar: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  border: '2px solid',
  objectFit: 'cover',
  background: '#1a1a1a',
};

const roleName: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const roleSub: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.2,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
};

const nameInput: React.CSSProperties = {
  marginTop: 18,
  padding: '12px 16px',
  fontSize: 16,
  background: 'rgba(255,255,255,0.05)',
  border: '2px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  color: '#fff',
  fontFamily: 'inherit',
  width: 280,
  textAlign: 'center',
  outline: 'none',
};

function joinButton(accent: string, enabled: boolean): React.CSSProperties {
  return {
    marginTop: 22,
    padding: '12px 36px',
    background: enabled ? accent : 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: 8,
    color: enabled ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 2,
    cursor: enabled ? 'pointer' : 'not-allowed',
    textTransform: 'uppercase',
    fontFamily: 'inherit',
  };
}
