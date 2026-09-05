// Unified left dock: one floating, collapsible panel that houses the player roster
// ("Squad") and Mr. X's 24-round trail ("Trail") behind tabs. Collapses to a 64px rail of
// avatars. Publishes `--hud-shift` / `--dock-w` on <html> so every centered overlay
// re-centers over the free map area (see tokens.ts).

import { useEffect, useMemo, useState } from 'react';
import type { Move, Player, RoleType } from '@yard/shared-utils';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { getTheme, characterFor } from '../core/theme-registry';
import { SHOW_CULPRIT_AT_MOVES, isRevealRound, nodeDisplayName } from '../core/map-data';
import { TOTAL_ROUNDS, culpritMoveCount } from '../core/move-validator';
import {
  COLOR,
  FONT,
  RADIUS,
  SHADOW,
  MOTION,
  SCREEN_MARGIN,
  DOCK_WIDTH,
  DOCK_RAIL_WIDTH,
  PLAYER_COLOR,
  TRANSPORT_CHIP,
  type ChipTone,
} from './tokens';

type DockTab = 'squad' | 'trail';

const STORAGE_KEY = 'yard.dock';
const NARROW_VIEWPORT = 900;

interface DockPrefs {
  open: boolean;
  tab: DockTab;
}

function loadPrefs(): DockPrefs {
  const fallback: DockPrefs = {
    open: typeof window === 'undefined' ? true : window.innerWidth >= NARROW_VIEWPORT,
    tab: 'squad',
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DockPrefs>;
    return {
      open: typeof parsed.open === 'boolean' ? parsed.open : fallback.open,
      tab: parsed.tab === 'trail' ? 'trail' : 'squad',
    };
  } catch {
    return fallback;
  }
}

function savePrefs(prefs: DockPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // private mode / quota — the dock still works for this session
  }
}

function publishShift(open: boolean | null) {
  const root = document.documentElement.style;
  if (open === null) {
    root.setProperty('--hud-shift', '0px');
    root.setProperty('--dock-w', '0px');
    return;
  }
  const width = open ? DOCK_WIDTH : DOCK_RAIL_WIDTH;
  root.setProperty('--dock-w', `${width}px`);
  root.setProperty('--hud-shift', `${(width + SCREEN_MARGIN) / 2}px`);
}

export function Dock() {
  const [prefs, setPrefs] = useState<DockPrefs>(loadPrefs);
  const { open, tab } = prefs;

  const players = useGameStateStore((s) => s.players);
  const moves = useGameStateStore((s) => s.moves);
  const status = useGameStateStore((s) => s.status);
  const channel = useGameStateStore((s) => s.channel);
  const currentTurn = useGameStateStore((s) => s.currentTurn);
  const themeId = useGameStateStore((s) => s.theme);
  const myRole = useRunnerStore((s) => s.myRole);
  const theme = getTheme(themeId);

  const culpritMoves = useMemo(() => moves.filter((m) => m.role === 'culprit'), [moves]);
  const playedRounds = culpritMoves.length;
  const round = Math.min(TOTAL_ROUNDS, Math.max(1, playedRounds + (status === 'finished' ? 0 : 1)));
  const nextReveal = SHOW_CULPRIT_AT_MOVES.find((r) => r >= round);
  const revealImminent = nextReveal != null && nextReveal - round <= 1;

  useEffect(() => {
    publishShift(open);
    return () => publishShift(null);
  }, [open]);

  const update = (patch: Partial<DockPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  };

  const caseLabel =
    channel === 'mock' || channel.startsWith('mock-')
      ? 'Mock game'
      : channel
      ? `Case ${channel.toUpperCase()}`
      : theme.name;

  return (
    <aside style={{ ...dock, width: open ? DOCK_WIDTH : DOCK_RAIL_WIDTH }} aria-label="Game dock">
      <div style={head}>
        <button
          type="button"
          className="hud-collapse"
          style={collapseBtn}
          onClick={() => update({ open: !open })}
          title={open ? 'Collapse panel' : 'Expand panel'}
          aria-label={open ? 'Collapse panel' : 'Expand panel'}
        >
          {open ? '⟨' : '⟩'}
        </button>
        {open && (
          <div style={title}>
            {caseLabel} · Round {round} of {TOTAL_ROUNDS}
          </div>
        )}
      </div>

      {open ? (
        <>
          <div style={tabs}>
            <button
              type="button"
              style={tabBtn(tab === 'squad')}
              onClick={() => update({ tab: 'squad' })}
            >
              Squad
            </button>
            <button
              type="button"
              style={tabBtn(tab === 'trail')}
              onClick={() => update({ tab: 'trail' })}
            >
              Trail
              <span style={trailBadge(revealImminent)}>
                R{round}
                {revealImminent ? ' ●' : ''}
              </span>
            </button>
          </div>
          <div className="hud-scroll" style={body}>
            {tab === 'squad' ? (
              <Squad players={players} moves={moves} currentTurn={currentTurn} myRole={myRole} />
            ) : (
              <Trail culpritMoves={culpritMoves} round={round} gameOver={status === 'finished'} />
            )}
          </div>
        </>
      ) : (
        <Rail
          players={players}
          round={round}
          currentTurn={currentTurn}
          myRole={myRole}
          onExpand={() => update({ open: true })}
        />
      )}
    </aside>
  );
}

// ─── Squad ───────────────────────────────────────────────────────────────────

function Squad({
  players,
  moves,
  currentTurn,
  myRole,
}: {
  players: Player[];
  moves: Move[];
  currentTurn: RoleType;
  myRole: RoleType | null;
}) {
  const themeId = useGameStateStore((s) => s.theme);
  const viewingAs = useRunnerStore((s) => s.viewingAs);
  const setViewingAs = useRunnerStore((s) => s.setViewingAs);
  const theme = getTheme(themeId);

  const revealedAt = useMemo(() => lastRevealNode(moves), [moves]);
  const onRevealRound = isRevealRound(culpritMoveCount(moves));

  if (players.length === 0) return <div style={emptyState}>Waiting for game state…</div>;

  return (
    <>
      {players.map((p) => {
        const isMe = myRole === p.role;
        const isCurrent = currentTurn === p.role;
        const isViewedAs = viewingAs === p.role && viewingAs !== myRole;
        const canImpersonate =
          myRole != null && myRole !== 'culprit' && p.role !== 'culprit' && p.role !== myRole;
        const isReturnTarget = isMe && viewingAs !== myRole;
        const canClick = canImpersonate || isReturnTarget;
        const character = characterFor(theme, p.role);
        const isCulprit = p.role === 'culprit';
        const accent = PLAYER_COLOR[p.role] ?? COLOR.fg2;

        let position: string;
        if (!isCulprit || isMe) position = nodeDisplayName(p.position);
        else if (onRevealRound && revealedAt != null) position = nodeDisplayName(revealedAt);
        else position = '???';

        return (
          <button
            key={p.role}
            type="button"
            className="hud-card"
            disabled={!canClick}
            onClick={() => {
              if (isReturnTarget && myRole) setViewingAs(myRole);
              else if (canImpersonate) setViewingAs(p.role);
            }}
            style={card(isMe, isCurrent, isViewedAs, canClick)}
            title={
              isReturnTarget
                ? 'Return to your seat'
                : canImpersonate
                ? `View the board as ${character.name}`
                : undefined
            }
          >
            <Avatar src={character.image} alt={character.name} size={42} ring={accent} />
            <div style={nameRow}>
              <span style={name}>{character.name}</span>
              {p.isAI && <span style={tag(COLOR.blueTint, 'rgba(79,143,216,.18)')}>AI</span>}
              {isMe && <span style={tag(COLOR.redTint, 'rgba(224,85,69,.2)')}>YOU</span>}
              {isCurrent && <span style={tag(COLOR.gold, 'rgba(232,182,76,.16)')}>TURN</span>}
            </div>
            <div style={location}>
              📍 {position}
              <span style={roleSub}>
                {isCulprit ? 'Mr. X' : `Detective ${p.role.replace('detective', '')}`}
              </span>
            </div>
            <div style={chips}>
              <Chip label={theme.transportation.taxi} count={p.taxiTickets} tone={TRANSPORT_CHIP.taxi} />
              <Chip label={theme.transportation.bus} count={p.busTickets} tone={TRANSPORT_CHIP.bus} />
              <Chip
                label={theme.transportation.underground}
                count={p.undergroundTickets}
                tone={TRANSPORT_CHIP.underground}
              />
              {isCulprit && (
                <>
                  <Chip
                    label={theme.transportation.secret}
                    count={p.secretTickets ?? 0}
                    tone={TRANSPORT_CHIP.secret}
                  />
                  <Chip
                    label={theme.transportation.double}
                    count={p.doubleTickets ?? 0}
                    tone={TRANSPORT_CHIP.double}
                  />
                </>
              )}
            </div>
          </button>
        );
      })}
      <DebugEndGame />
    </>
  );
}

function Chip({ label, count, tone }: { label: string; count: number; tone: ChipTone }) {
  const empty = count <= 0;
  return (
    <span
      style={{
        ...chip,
        color: empty ? 'rgba(255,255,255,.3)' : tone.color,
        borderColor: empty ? 'rgba(255,255,255,.1)' : tone.border,
      }}
      title={`${label}: ${count}`}
    >
      {label.slice(0, 4).toUpperCase()} {count}
    </span>
  );
}

function Avatar({
  src,
  alt,
  size,
  ring,
  glow,
}: {
  src: string;
  alt: string;
  size: number;
  ring: string;
  glow?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${ring}`,
        objectFit: 'cover',
        background: COLOR.avatarBg,
        gridRow: '1 / 3',
        boxShadow: glow ? `0 0 0 2px ${glow}` : undefined,
        flexShrink: 0,
      }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
      }}
    />
  );
}

function lastRevealNode(moves: Move[]): number | null {
  const culpritMoves = moves.filter((m) => m.role === 'culprit');
  for (let i = culpritMoves.length - 1; i >= 0; i--) {
    if (isRevealRound(i + 1) && culpritMoves[i].position != null) {
      return culpritMoves[i].position as number;
    }
  }
  return null;
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
      style={debugBtn}
      title="Debug: end the mock game so the replay scrubber can be tested"
    >
      ▣ End game (debug)
    </button>
  );
}

// ─── Trail ───────────────────────────────────────────────────────────────────

function Trail({
  culpritMoves,
  round,
  gameOver,
}: {
  culpritMoves: Move[];
  round: number;
  gameOver: boolean;
}) {
  const themeId = useGameStateStore((s) => s.theme);
  const theme = getTheme(themeId);
  return (
    <>
      <div style={trailHead}>
        <span>Mr. X's trail</span>
        <span>Reveals: {SHOW_CULPRIT_AT_MOVES.join(' · ')}</span>
      </div>
      <div style={trailGrid}>
        {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
          const r = i + 1;
          const move = culpritMoves[i];
          const reveal = isRevealRound(r);
          const current = r === round && !gameOver;
          const showPosition = move != null && (reveal || gameOver) && move.position != null;
          return (
            <div
              key={r}
              style={cell(move != null, reveal, current)}
              title={showPosition ? nodeDisplayName(move.position as number) : undefined}
            >
              <span style={cellNumber(reveal, current)}>{r}</span>
              <span style={cellLabel(move)}>
                {move ? transportAbbrev(move, theme) : reveal ? '👁' : '—'}
              </span>
              {showPosition && <span style={cellPosition}>#{move.position}</span>}
            </div>
          );
        })}
      </div>
      <div style={legend}>
        <span style={legendItem}>
          <i style={{ ...swatch, background: COLOR.raised, border: '1px solid rgba(255,255,255,.15)' }} />
          played
        </span>
        <span style={legendItem}>
          <i style={{ ...swatch, background: 'rgba(224,85,69,.35)' }} />
          reveal
        </span>
        <span style={legendItem}>
          <i style={{ ...swatch, border: `1px solid ${COLOR.gold}` }} />
          current
        </span>
      </div>
    </>
  );
}

function transportAbbrev(move: Move, theme: ReturnType<typeof getTheme>): string {
  const label = move.secret
    ? theme.transportation.secret
    : move.type === 'taxi'
    ? theme.transportation.taxi
    : move.type === 'bus'
    ? theme.transportation.bus
    : move.type === 'underground'
    ? theme.transportation.underground
    : move.type === 'river'
    ? theme.transportation.river
    : move.type;
  return `${label.slice(0, 4).toUpperCase()}${move.double ? ' ×2' : ''}`;
}

// ─── Rail ────────────────────────────────────────────────────────────────────

function Rail({
  players,
  round,
  currentTurn,
  myRole,
  onExpand,
}: {
  players: Player[];
  round: number;
  currentTurn: RoleType;
  myRole: RoleType | null;
  onExpand: () => void;
}) {
  const themeId = useGameStateStore((s) => s.theme);
  const theme = getTheme(themeId);
  const detectives = players.filter((p) => p.role !== 'culprit');
  const culprit = players.find((p) => p.role === 'culprit');
  const mini = (p: Player) => {
    const accent = PLAYER_COLOR[p.role] ?? COLOR.fg2;
    const isMe = p.role === myRole;
    const isCurrent = p.role === currentTurn;
    return (
      <Avatar
        key={p.role}
        src={characterFor(theme, p.role).image}
        alt={characterFor(theme, p.role).name}
        size={36}
        ring={isCurrent ? COLOR.gold : accent}
        glow={isMe ? 'rgba(224,85,69,.4)' : undefined}
      />
    );
  };
  return (
    <div
      style={rail}
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onExpand();
      }}
      title="Expand panel"
    >
      <div style={roundChip}>
        R {round} / {TOTAL_ROUNDS}
      </div>
      <div style={sep} />
      {detectives.map(mini)}
      {culprit && (
        <>
          <div style={sep} />
          {mini(culprit)}
        </>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const dock: React.CSSProperties = {
  position: 'fixed',
  top: SCREEN_MARGIN,
  left: SCREEN_MARGIN,
  bottom: SCREEN_MARGIN,
  background: COLOR.panel,
  borderRadius: RADIUS.dock,
  boxShadow: SHADOW.dock,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 40,
  transition: `width ${MOTION}`,
  color: COLOR.fg,
  fontFamily: FONT.ui,
};

const head: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 14px 10px',
  minHeight: 58,
};

const collapseBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: RADIUS.control,
  border: `1px solid ${COLOR.hairline}`,
  background: COLOR.raised,
  color: COLOR.fg2,
  cursor: 'pointer',
  fontSize: 15,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontFamily: FONT.ui,
};

const title: React.CSSProperties = {
  font: `700 15px ${FONT.ui}`,
  letterSpacing: '.02em',
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const tabs: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '0 14px 12px',
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    border: `1px solid ${active ? 'rgba(232,182,76,.45)' : COLOR.hairline}`,
    background: active ? COLOR.raised : 'transparent',
    color: active ? COLOR.fg : COLOR.fg2,
    padding: '8px 0',
    borderRadius: RADIUS.control,
    font: `600 12.5px ${FONT.ui}`,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  };
}

function trailBadge(hot: boolean): React.CSSProperties {
  return {
    font: `600 10px ${FONT.mono}`,
    background: hot ? 'rgba(224,85,69,.18)' : 'rgba(255,255,255,.06)',
    color: hot ? COLOR.redTint : COLOR.fg2,
    borderRadius: 99,
    padding: '1px 6px',
    textTransform: 'none',
    letterSpacing: 0,
  };
}

const body: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '4px 12px 12px',
};

function card(isMe: boolean, isCurrent: boolean, isViewedAs: boolean, clickable: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '42px 1fr',
    gap: '4px 12px',
    padding: '11px 12px',
    borderRadius: RADIUS.card,
    border: `1px solid ${
      isMe ? 'rgba(224,85,69,.5)' : isViewedAs ? 'rgba(79,143,216,.55)' : isCurrent ? 'rgba(232,182,76,.35)' : 'transparent'
    }`,
    background: isMe ? 'rgba(224,85,69,.07)' : isViewedAs ? 'rgba(79,143,216,.08)' : 'transparent',
    marginBottom: 6,
    cursor: clickable ? 'pointer' : 'default',
    color: COLOR.fg,
    fontFamily: FONT.ui,
    textAlign: 'left',
    width: '100%',
    opacity: 1,
    transition: `background 150ms ease, border-color 150ms ease`,
  };
}

const nameRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  flexWrap: 'wrap',
};

const name: React.CSSProperties = {
  font: `600 14.5px ${FONT.ui}`,
  whiteSpace: 'nowrap',
};

function tag(color: string, background: string): React.CSSProperties {
  return {
    font: `600 9.5px ${FONT.mono}`,
    letterSpacing: '.08em',
    padding: '1.5px 6px',
    borderRadius: RADIUS.tag,
    background,
    color,
  };
}

const location: React.CSSProperties = {
  font: `500 11.5px ${FONT.ui}`,
  color: COLOR.fg2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: 'flex',
  gap: 8,
  alignItems: 'baseline',
};

const roleSub: React.CSSProperties = {
  color: 'rgba(255,255,255,.35)',
  fontSize: 10,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
};

const chips: React.CSSProperties = {
  gridColumn: 2,
  display: 'flex',
  gap: 5,
  marginTop: 3,
  flexWrap: 'wrap',
};

const chip: React.CSSProperties = {
  font: `600 10.5px ${FONT.mono}`,
  padding: '2px 7px',
  borderRadius: RADIUS.chip,
  border: '1px solid',
  whiteSpace: 'nowrap',
};

const emptyState: React.CSSProperties = {
  padding: 16,
  color: COLOR.fg2,
  fontSize: 12,
  fontStyle: 'italic',
  textAlign: 'center',
};

const debugBtn: React.CSSProperties = {
  marginTop: 8,
  padding: '6px 10px',
  background: 'transparent',
  border: `1px dashed ${COLOR.hairline}`,
  borderRadius: RADIUS.control,
  color: COLOR.fg2,
  font: `600 10px ${FONT.mono}`,
  letterSpacing: '.08em',
  cursor: 'pointer',
  textTransform: 'uppercase',
  width: '100%',
};

const trailHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '6px 6px 12px',
  font: `600 12px ${FONT.ui}`,
  color: COLOR.fg2,
};

const trailGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 7,
  padding: '0 2px',
};

function cell(played: boolean, reveal: boolean, current: boolean): React.CSSProperties {
  return {
    aspectRatio: '1',
    borderRadius: RADIUS.cell,
    border: `1px solid ${current ? COLOR.gold : reveal ? 'rgba(224,85,69,.6)' : COLOR.hairline}`,
    boxShadow: current ? `0 0 0 1px ${COLOR.gold} inset` : undefined,
    background: reveal ? 'rgba(224,85,69,.12)' : played ? COLOR.raised : 'rgba(255,255,255,.02)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 0,
  };
}

function cellNumber(reveal: boolean, current: boolean): React.CSSProperties {
  return {
    font: `600 12px ${FONT.mono}`,
    color: current ? COLOR.gold : reveal ? COLOR.redTint : COLOR.fg2,
  };
}

function cellLabel(move: Move | undefined): React.CSSProperties {
  return {
    font: `600 8.5px ${FONT.mono}`,
    letterSpacing: '.05em',
    color: move ? COLOR.fg : COLOR.fg2,
    whiteSpace: 'nowrap',
  };
}

const cellPosition: React.CSSProperties = {
  font: `500 8.5px ${FONT.mono}`,
  color: COLOR.redTint,
};

const legend: React.CSSProperties = {
  display: 'flex',
  gap: 14,
  padding: '14px 6px 4px',
  font: `500 10.5px ${FONT.ui}`,
  color: COLOR.fg2,
};

const legendItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
};

const swatch: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 3,
  display: 'inline-block',
};

const rail: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '6px 0',
  flex: 1,
  cursor: 'pointer',
};

const roundChip: React.CSSProperties = {
  writingMode: 'vertical-rl',
  font: `600 11px ${FONT.mono}`,
  letterSpacing: '.15em',
  color: COLOR.gold,
  padding: '10px 0',
  whiteSpace: 'nowrap',
};

const sep: React.CSSProperties = {
  width: 28,
  height: 1,
  background: COLOR.hairline,
  margin: '4px 0',
};
