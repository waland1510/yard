// Dev-mode debug overlay. Ctrl+D toggles. Shows raw game state, current connection
// status, deduction internals (possible nodes + top weights), and Mr. X's actual position
// (spoiler — visible only with debug enabled).

import { useEffect, useMemo } from 'react';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';
import { runDeduction } from '../core/deduction-engine';
import { nodeDisplayName } from '../core/map-data';

export function DebugOverlay() {
  const debugEnabled = useRunnerStore((s) => s.debugEnabled);
  const setDebugEnabled = useRunnerStore((s) => s.setDebugEnabled);
  const players = useGameStateStore((s) => s.players);
  const moves = useGameStateStore((s) => s.moves);
  const currentTurn = useGameStateStore((s) => s.currentTurn);
  const status = useGameStateStore((s) => s.status);
  const channel = useGameStateStore((s) => s.channel);
  const theme = useGameStateStore((s) => s.theme);
  const isDoubleMove = useGameStateStore((s) => s.isDoubleMove);
  const connection = useGameStateStore((s) => s.connection);
  const myRole = useRunnerStore((s) => s.myRole);

  // Ctrl+D toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setDebugEnabled(!useRunnerStore.getState().debugEnabled);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setDebugEnabled]);

  const culprit = useMemo(() => players.find((p) => p.role === 'culprit'), [players]);
  const culpritMoves = useMemo(() => moves.filter((m) => m.role === 'culprit'), [moves]);
  const deduction = useMemo(() => {
    if (players.length === 0) return null;
    return runDeduction(moves, players);
  }, [moves, players]);

  const topWeights = useMemo(() => {
    if (!deduction) return [];
    return Array.from(deduction.weights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [deduction]);

  if (!debugEnabled) return null;

  return (
    <div style={panel}>
      <div style={header}>
        <span style={title}>DEBUG</span>
        <span style={hint}>Ctrl+D to close</span>
      </div>

      <Row label="Status" value={status} />
      <Row label="Channel" value={channel || '—'} />
      <Row label="WS" value={connection} />
      <Row label="Theme" value={theme} />
      <Row label="My role" value={myRole ?? '—'} />
      <Row label="Current turn" value={currentTurn} />
      <Row label="Double-move in progress" value={isDoubleMove ? 'yes' : 'no'} />
      <Row label="Moves" value={`${moves.length} (culprit: ${culpritMoves.length})`} />

      <Section title="Mr. X actual" />
      {culprit ? (
        <>
          <Row label="Position" value={`${nodeDisplayName(culprit.position)} (#${culprit.position})`} highlight />
          <Row
            label="Tickets"
            value={`taxi ${culprit.taxiTickets} · bus ${culprit.busTickets} · und ${culprit.undergroundTickets} · secret ${culprit.secretTickets ?? 0} · double ${culprit.doubleTickets ?? 0}`}
          />
        </>
      ) : (
        <Row label="—" value="no culprit in store" />
      )}

      <Section title="Deduction" />
      {deduction ? (
        <>
          <Row label="Round" value={String(deduction.round)} />
          <Row label="Possible nodes" value={String(deduction.possible.size)} />
          <div style={{ marginTop: 4 }}>
            {topWeights.map(([nodeId, w]) => (
              <div key={nodeId} style={weightRow}>
                <span style={weightNode}>
                  {nodeDisplayName(nodeId)}{' '}
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>#{nodeId}</span>
                </span>
                <span style={weightBar}>
                  <span
                    style={{
                      ...weightBarFill,
                      width: `${Math.round(w * 100)}%`,
                    }}
                  />
                </span>
                <span style={weightPct}>{(w * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Row label="—" value="not yet computable" />
      )}

      <Section title="Detectives" />
      {players
        .filter((p) => p.role !== 'culprit')
        .map((p) => (
          <Row
            key={p.role}
            label={p.role}
            value={`${nodeDisplayName(p.position)} (#${p.position}) · taxi ${p.taxiTickets}/bus ${p.busTickets}/und ${p.undergroundTickets}`}
          />
        ))}

      <Section title="Last 6 moves" />
      <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.7)' }}>
        {moves.slice(-6).map((m, i) => (
          <div key={i}>
            {m.role} · {m.type}
            {m.secret ? ' [secret]' : ''}
            {m.double ? ' [double]' : ''} → {m.position}
          </div>
        ))}
        {moves.length === 0 && <div style={{ color: 'rgba(255,255,255,0.35)' }}>none</div>}
      </div>
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={row}>
      <span style={rowLabel}>{label}</span>
      <span style={{ ...rowValue, color: highlight ? '#ff6b35' : 'rgba(255,255,255,0.9)' }}>{value}</span>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div style={sectionStyle}>
      <span style={sectionLabel}>{title}</span>
    </div>
  );
}

const panel: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 22,
  width: 380,
  maxHeight: 'calc(100vh - 100px)',
  overflowY: 'auto',
  background: 'rgba(10, 12, 16, 0.94)',
  border: '1px solid rgba(94, 141, 222, 0.35)',
  borderRadius: 10,
  padding: '14px 16px',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 11,
  zIndex: 20,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const title: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 3,
  color: '#5a8dde',
};

const hint: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.4)',
  letterSpacing: 1,
};

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 12,
  padding: '3px 0',
};

const rowLabel: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  flexShrink: 0,
};

const rowValue: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'ui-monospace, monospace',
  textAlign: 'right',
};

const sectionStyle: React.CSSProperties = {
  marginTop: 10,
  paddingTop: 8,
  borderTop: '1px solid rgba(255,255,255,0.06)',
  marginBottom: 4,
};

const sectionLabel: React.CSSProperties = {
  color: '#5a8dde',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: 'uppercase',
};

const weightRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 60px 36px',
  alignItems: 'center',
  gap: 6,
  padding: '2px 0',
};

const weightNode: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'ui-monospace, monospace',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const weightBar: React.CSSProperties = {
  display: 'inline-block',
  height: 4,
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 2,
  position: 'relative',
  overflow: 'hidden',
};

const weightBarFill: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  background: '#ff6b35',
  borderRadius: 2,
};

const weightPct: React.CSSProperties = {
  fontSize: 9,
  color: 'rgba(255,255,255,0.55)',
  fontFamily: 'ui-monospace, monospace',
  textAlign: 'right',
};
