// Every move available from the current stop as a list of native buttons — the keyboard
// path to the same moves the 3D vehicles and map markers offer. `M` opens it and focuses
// the first playable move; arrows walk the list, Enter plays, Escape leaves.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Connection, TransportKind } from '../game/connections';
import { nodeDisplayName } from '../core/map-data';
import { useGameStateStore } from '../stores/game-state-store';
import { getTheme } from '../core/theme-registry';
import { moveTicketKind, type MoveTicketInventory } from '../core/move-validator';
import { COLOR, FONT, RADIUS, SHADOW, TAP, TRANSPORT_CHIP } from './tokens';
import { useNarrowViewport } from './use-viewport';
import './destination-list.css';

interface DestinationListProps {
  connections: readonly Connection[];
  tickets: MoveTicketInventory;
  secretArmed?: boolean;
  /** False while it is someone else's turn; moves stay listed but cannot be played. */
  canMove: boolean;
  surface: 'fpv' | 'map';
  touch: boolean;
  onPick: (connection: Connection) => void;
  onHighlight?: (connection: Connection | null) => void;
}

const KIND_ORDER: readonly TransportKind[] = ['taxi', 'bus', 'underground', 'river'];

const KIND_ICON: Record<TransportKind, string> = {
  taxi: '🚖',
  bus: '🚌',
  underground: 'Ⓤ',
  river: '⛴️',
};

const MOVE_SELECTOR = 'button[data-move]:not(:disabled)';

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"]');
}

export function DestinationList({
  connections,
  tickets,
  secretArmed = false,
  canMove,
  surface,
  touch,
  onPick,
  onHighlight,
}: DestinationListProps) {
  const narrow = useNarrowViewport();
  const themeId = useGameStateStore((s) => s.theme);
  const theme = getTheme(themeId);
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? !narrow;
  const listId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusFirstOnOpen = useRef(false);

  const sorted = useMemo(
    () =>
      [...connections].sort(
        (a, b) =>
          KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.targetNodeId - b.targetNodeId
      ),
    [connections]
  );

  useEffect(() => {
    if (sorted.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm' || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target) || document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      if (open) {
        const first = listRef.current?.querySelector<HTMLButtonElement>(MOVE_SELECTOR);
        (first ?? toggleRef.current)?.focus();
      } else {
        focusFirstOnOpen.current = true;
        setManualOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sorted.length]);

  useEffect(() => {
    if (!open || !focusFirstOnOpen.current) return;
    focusFirstOnOpen.current = false;
    const first = listRef.current?.querySelector<HTMLButtonElement>(MOVE_SELECTOR);
    (first ?? toggleRef.current)?.focus();
  }, [open]);

  useEffect(() => () => onHighlight?.(null), [onHighlight, connections, open, canMove, tickets, secretArmed]);

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(MOVE_SELECTOR));
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    items[(at + step + items.length) % items.length].focus();
  };

  if (sorted.length === 0) return null;

  const affordable = sorted.filter((connection) => tickets[moveTicketKind(connection.kind, secretArmed)] > 0).length;

  return (
    <nav
      className="hud-destinations"
      aria-label="Available moves"
      data-surface={surface}
      data-open={open}
      style={panel}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return;
        e.preventDefault();
        setManualOpen(false);
        toggleRef.current?.focus();
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        style={header}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setManualOpen(!open)}
      >
        <span>Moves</span>
        <span style={headerCount}>{affordable}</span>
        {!touch && <kbd style={kbd}>M</kbd>}
        <span style={chevron} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <>
          {!canMove && <div style={waiting}>Not your turn — moves unlock when it is.</div>}
          <ul id={listId} ref={listRef} className="hud-scroll" style={list} onKeyDown={onListKeyDown}>
            {sorted.map((c) => {
              const ticketKind = moveTicketKind(c.kind, secretArmed);
              const remaining = tickets[ticketKind];
              const noTicket = remaining <= 0;
              const tone = TRANSPORT_CHIP[c.kind];
              const transport = theme.transportation[c.kind];
              const ticketName = theme.transportation[ticketKind];
              const name = nodeDisplayName(c.targetNodeId);
              return (
                <li key={`${c.kind}-${c.targetNodeId}`}>
                  <button
                    type="button"
                    data-move
                    className="hud-move"
                    style={{ ...item, opacity: noTicket ? 0.6 : 1 }}
                    disabled={!canMove || noTicket}
                    onClick={() => {
                      if (narrow) setManualOpen(false);
                      onPick(c);
                    }}
                    onFocus={() => onHighlight?.(c)}
                    onBlur={() => onHighlight?.(null)}
                    onMouseEnter={() => onHighlight?.(c)}
                    onMouseLeave={(event) => {
                      if (event.currentTarget !== document.activeElement) onHighlight?.(null);
                    }}
                    aria-label={
                      noTicket
                        ? `${transport} to ${name}, stop ${c.targetNodeId} — no ${ticketName} ticket`
                        : `${transport} to ${name}, stop ${c.targetNodeId} — ${remaining} ${ticketName} ticket${remaining === 1 ? '' : 's'} left`
                    }
                  >
                    <span style={{ ...icon, color: tone.color }} aria-hidden>
                      {KIND_ICON[c.kind]}
                    </span>
                    <span style={itemBody}>
                      <span style={itemName}>
                        {name}
                        {!name.includes(`#${c.targetNodeId}`) && <span style={itemId}>#{c.targetNodeId}</span>}
                      </span>
                      <span style={{ ...itemMeta, color: tone.color }}>{theme.transportationShort[c.kind]}</span>
                    </span>
                    <span style={{ ...itemCount, color: noTicket ? COLOR.redTint : COLOR.fg2 }}>
                      {noTicket ? 'no ticket' : `×${remaining}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </nav>
  );
}

const panel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: COLOR.panel,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.card,
  boxShadow: SHADOW.dock,
  color: COLOR.fg,
  fontFamily: FONT.ui,
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: TAP,
  padding: '0 12px',
  background: 'transparent',
  border: 0,
  color: COLOR.fg,
  cursor: 'pointer',
  font: `700 12.5px ${FONT.ui}`,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  transform: 'none',
  flexShrink: 0,
};

const headerCount: React.CSSProperties = {
  font: `600 11px ${FONT.mono}`,
  color: COLOR.gold,
  background: 'rgba(232,182,76,.14)',
  borderRadius: RADIUS.pill,
  padding: '1px 7px',
  letterSpacing: 0,
};

const kbd: React.CSSProperties = {
  marginLeft: 'auto',
  font: `600 10px ${FONT.mono}`,
  color: COLOR.fg2,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.tag,
  padding: '1px 6px',
  letterSpacing: 0,
};

const chevron: React.CSSProperties = {
  color: COLOR.fg2,
  fontSize: 11,
};

const waiting: React.CSSProperties = {
  padding: '0 12px 8px',
  font: `500 11.5px ${FONT.ui}`,
  color: COLOR.fg2,
};

const list: React.CSSProperties = {
  listStyle: 'none',
  overflowY: 'auto',
  padding: '0 6px 6px',
  borderTop: `1px solid ${COLOR.hairline}`,
};

const item: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  minHeight: TAP,
  padding: '6px 8px',
  marginTop: 4,
  background: 'transparent',
  border: 0,
  borderRadius: RADIUS.control,
  color: COLOR.fg,
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: FONT.ui,
  transform: 'none',
};

const icon: React.CSSProperties = {
  width: 22,
  textAlign: 'center',
  fontSize: 16,
  flexShrink: 0,
};

const itemBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  flex: 1,
  lineHeight: 1.25,
};

const itemName: React.CSSProperties = {
  font: `600 13px ${FONT.ui}`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const itemId: React.CSSProperties = {
  marginLeft: 6,
  font: `500 11px ${FONT.mono}`,
  color: COLOR.fg2,
};

const itemMeta: React.CSSProperties = {
  font: `600 10px ${FONT.mono}`,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
};

const itemCount: React.CSSProperties = {
  font: `600 11px ${FONT.mono}`,
  flexShrink: 0,
};
