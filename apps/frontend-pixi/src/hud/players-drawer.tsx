// Left-side collapsible drawer listing all 6 players with character image, tickets,
// position (hidden for Mr. X unless revealed). Click a detective card to "impersonate"
// their view (per the legacy frontend's perspective-switch semantics).

import { useMemo } from 'react';
import type { Move, Player } from '@yard/shared-utils';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme, characterFor } from '../core/theme-registry';
import { ROLE_PALETTE, SHOW_CULPRIT_AT_MOVES, nodeDisplayName } from '../core/map-data';

export function PlayersDrawer() {
  // Drawer is always visible — no collapse handle in FPV mode. The store flags
  // are kept around in case we want to add a temporary hide-on-ride later.
  const players = useGameStateStore((s) => s.players);
  const currentTurn = useGameStateStore((s) => s.currentTurn);
  const moves = useGameStateStore((s) => s.moves);
  const themeId = useGameStateStore((s) => s.theme);
  const myRole = useRunnerStore((s) => s.myRole);
  const viewingAs = useRunnerStore((s) => s.viewingAs);
  const setViewingAs = useRunnerStore((s) => s.setViewingAs);

  const theme = getTheme(themeId);
  const culpritRevealedAt = useMemo(() => lastRevealNode(moves), [moves]);
  const isOnRevealRound = useMemo(() => {
    const culpritMoves = moves.filter((m) => m.role === 'culprit').length;
    return SHOW_CULPRIT_AT_MOVES.includes(culpritMoves as 3 | 8 | 13 | 18 | 24);
  }, [moves]);

  return (
    <>
      <aside style={{ ...drawer, left: 0 }}>
        <div style={drawerHeader}>
          <h3 style={drawerTitle}>The Table</h3>
          <div style={drawerSub}>{theme.name}</div>
          <DebugEndGame />
        </div>
        <div style={cardList}>
          {players.length === 0 && <div style={emptyState}>Waiting for game state…</div>}
          {players.map((p) => {
            const isCurrent = currentTurn === p.role;
            const isMe = myRole === p.role;
            const isViewedAs = viewingAs === p.role;
            // Impersonation is detective-only: the culprit can't slip into a detective seat,
            // and detectives can't slip into Mr. X's seat. Sides are locked.
            const canImpersonate =
              myRole != null &&
              myRole !== 'culprit' &&
              p.role !== 'culprit' &&
              p.role !== myRole;
            // While impersonating, clicking your own card returns to your view
            const isReturnTarget = isMe && viewingAs !== myRole;
            const canClick = canImpersonate || isReturnTarget;
            const character = characterFor(theme, p.role);
            const isCulprit = p.role === 'culprit';
            // Position visibility:
            //  - Always show for the local player (so I see my own location)
            //  - Always show for detectives (their positions are public)
            //  - Mr. X: show only on reveal rounds, or to the culprit themselves
            let positionLabel: string;
            if (!isCulprit || isMe) {
              positionLabel = nodeDisplayName(p.position);
            } else if (isOnRevealRound && culpritRevealedAt != null) {
              positionLabel = nodeDisplayName(culpritRevealedAt);
            } else {
              positionLabel = '???';
            }
            return (
              <button
                key={p.role}
                onClick={() => {
                  if (isReturnTarget && myRole) setViewingAs(myRole);
                  else if (canImpersonate) setViewingAs(p.role);
                }}
                style={card(isCurrent, isMe || isViewedAs, ROLE_PALETTE[p.role as keyof typeof ROLE_PALETTE])}
                disabled={!canClick}
              >
                <img
                  src={character.image}
                  alt={character.name}
                  style={{ ...avatar, borderColor: isCurrent ? '#ff6b35' : 'rgba(255,255,255,0.2)' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                  }}
                />
                <div style={cardBody}>
                  <div style={cardName}>
                    {character.name}
                    {p.isAI && <span style={aiBadge}>AI</span>}
                    {isMe && <span style={youBadge}>YOU</span>}
                  </div>
                  <div style={cardRole}>
                    {p.role === 'culprit' ? 'Mr. X' : `Detective ${p.role.replace('detective', '')}`}
                  </div>
                  <div style={cardPosition}>
                    📍 <strong>{positionLabel}</strong>
                  </div>
                  <TicketRow player={p} theme={theme} />
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}

function TicketRow({ player, theme }: { player: Player; theme: ReturnType<typeof getTheme> }) {
  const isCulprit = player.role === 'culprit';
  return (
    <div style={ticketRowStyle}>
      <TicketChip label={theme.transportation.taxi} count={player.taxiTickets} color="#f6c945" />
      <TicketChip label={theme.transportation.bus} count={player.busTickets} color="#e25555" />
      <TicketChip label={theme.transportation.underground} count={player.undergroundTickets} color="#5a8dde" />
      {isCulprit && (
        <>
          <TicketChip label={theme.transportation.secret} count={player.secretTickets ?? 0} color="#a06bd8" />
          <TicketChip label={theme.transportation.double} count={player.doubleTickets ?? 0} color="#4e88c2" />
        </>
      )}
    </div>
  );
}

function TicketChip({ label, count, color }: { label: string; count: number; color: string }) {
  const empty = count <= 0;
  return (
    <div
      style={{
        ...ticketChip,
        borderColor: empty ? 'rgba(255,255,255,0.15)' : color,
        color: empty ? 'rgba(255,255,255,0.35)' : color,
      }}
      title={`${label}: ${count}`}
    >
      <span style={{ fontSize: 9, letterSpacing: 0.6 }}>{label.slice(0, 4).toUpperCase()}</span>
      <span style={{ fontWeight: 700 }}>{count}</span>
    </div>
  );
}

function DebugEndGame() {
  const channel = useGameStateStore((s) => s.channel);
  const status = useGameStateStore((s) => s.status);
  const setFinished = useGameStateStore((s) => s.setFinished);
  const isMock = channel === 'mock' || channel.startsWith('mock-');
  if (!isMock || status !== 'active') return null;
  return (
    <button
      type="button"
      onClick={() => setFinished()}
      style={{
        marginTop: 8,
        padding: '4px 10px',
        background: 'transparent',
        border: '1px dashed rgba(255,255,255,0.2)',
        borderRadius: 4,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        letterSpacing: 1.2,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textTransform: 'uppercase',
      }}
      title="Debug: end the mock game so the replay scrubber can be tested"
    >
      ▣ End Game (debug)
    </button>
  );
}

function lastRevealNode(moves: Move[]): number | null {
  const culpritMoves = moves.filter((m) => m.role === 'culprit');
  for (let i = culpritMoves.length - 1; i >= 0; i--) {
    const round = i + 1;
    if (SHOW_CULPRIT_AT_MOVES.includes(round as 3 | 8 | 13 | 18 | 24) && culpritMoves[i].position != null) {
      return culpritMoves[i].position as number;
    }
  }
  return null;
}

const DRAWER_WIDTH = 280;

const drawer: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  width: DRAWER_WIDTH,
  height: '100vh',
  background: 'rgba(10, 12, 16, 0.92)',
  borderRight: '1px solid rgba(255,255,255,0.08)',
  zIndex: 8,
  padding: '24px 16px',
  display: 'flex',
  flexDirection: 'column',
  transition: 'left 240ms ease',
  backdropFilter: 'blur(8px)',
  boxShadow: '4px 0 20px rgba(0,0,0,0.4)',
};

const handle: React.CSSProperties = {
  position: 'fixed',
  top: 100,
  background: 'rgba(10, 12, 16, 0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderLeft: 'none',
  borderRadius: '0 8px 8px 0',
  padding: '12px 8px',
  color: '#fff',
  cursor: 'pointer',
  zIndex: 9,
  transition: 'left 240ms ease',
  writingMode: 'horizontal-tb',
  fontSize: 13,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  letterSpacing: 1.2,
};

const handleLabel: React.CSSProperties = {
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  fontSize: 10,
  letterSpacing: 1.5,
};

const drawerHeader: React.CSSProperties = {
  paddingBottom: 12,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  marginBottom: 12,
};

const drawerTitle: React.CSSProperties = {
  fontSize: 16,
  letterSpacing: 2.5,
  margin: 0,
  color: '#fff',
};

const drawerSub: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
  marginTop: 2,
  fontStyle: 'italic',
};

const cardList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflowY: 'auto',
  flex: 1,
};

function card(isCurrent: boolean, isMine: boolean, accent: string): React.CSSProperties {
  return {
    display: 'flex',
    gap: 10,
    padding: '10px 10px',
    background: isCurrent ? 'rgba(255, 107, 53, 0.12)' : 'rgba(255,255,255,0.03)',
    border: `1.5px solid ${isCurrent ? '#ff6b35' : isMine ? accent : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 8,
    cursor: 'pointer',
    color: '#fff',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'all 160ms ease',
    width: '100%',
  };
}

const avatar: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  border: '2px solid',
  objectFit: 'cover',
  background: '#1a1a1a',
};

const cardBody: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};

const cardName: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const aiBadge: React.CSSProperties = {
  background: 'rgba(94, 141, 222, 0.25)',
  color: '#5a8dde',
  fontSize: 9,
  fontWeight: 700,
  padding: '1px 5px',
  borderRadius: 3,
  letterSpacing: 0.8,
};

const youBadge: React.CSSProperties = {
  background: 'rgba(255, 107, 53, 0.25)',
  color: '#ff6b35',
  fontSize: 9,
  fontWeight: 700,
  padding: '1px 5px',
  borderRadius: 3,
  letterSpacing: 0.8,
};

const cardRole: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.5)',
  letterSpacing: 1.2,
  textTransform: 'uppercase',
};

const cardPosition: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.85)',
  marginTop: 2,
};

const ticketRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 3,
  marginTop: 6,
  flexWrap: 'wrap',
};

const ticketChip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  padding: '2px 5px',
  border: '1px solid',
  borderRadius: 3,
  fontSize: 11,
  background: 'rgba(0,0,0,0.4)',
};

const emptyState: React.CSSProperties = {
  padding: 16,
  color: 'rgba(255,255,255,0.4)',
  fontSize: 12,
  fontStyle: 'italic',
  textAlign: 'center',
};
