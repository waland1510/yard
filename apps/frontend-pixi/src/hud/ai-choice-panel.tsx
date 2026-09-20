// Shown when the two AI deciders disagree on an AI detective's move. Any human in the
// game picks one; the server commits it. Disappears when the move lands or the server
// times out to the heuristic.

import { useEffect, useRef, useState } from 'react';
import type { AiDecisionSource, AiProposalOption, RoleType } from '@yard/shared-utils';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore, selectActiveSurface } from '../stores/runner-store';
import { getWebSocketClient } from '../net/websocket-client';
import { nodeDisplayName } from '../core/map-data';
import { COLOR, FONT, MOTION, RADIUS, SHADOW, centeredX } from './tokens';

const LABEL: Record<AiDecisionSource, string> = { heuristic: 'Heuristic', jev: 'Jev' };
const PROPOSAL_COLOR: Record<AiDecisionSource, string> = { heuristic: COLOR.gold, jev: COLOR.purple };

export function AiChoicePanel() {
  const proposal = useGameStateStore((s) => s.aiProposal);
  const status = useGameStateStore((s) => s.status);
  const surface = useRunnerStore(selectActiveSurface);
  const [picked, setPicked] = useState<AiDecisionSource | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  // In first-person there is no camera to pan, so we step into the AI detective's shoes
  // for the duration of the proposal and step back out when it resolves.
  const restoreViewRef = useRef<RoleType | null | undefined>(undefined);

  useEffect(() => {
    const runner = useRunnerStore.getState();
    if (proposal && surface === 'fpv') {
      if (restoreViewRef.current === undefined) restoreViewRef.current = runner.viewingAs;
      if (runner.viewingAs !== proposal.role) runner.setViewingAs(proposal.role);
    } else if (!proposal && restoreViewRef.current !== undefined) {
      runner.setViewingAs(restoreViewRef.current);
      restoreViewRef.current = undefined;
    }
  }, [proposal, surface]);

  useEffect(() => {
    setPicked(null);
    if (!proposal) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((proposal.expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [proposal]);

  if (!proposal || status === 'finished') return null;

  const choose = (source: AiDecisionSource) => {
    if (picked) return;
    setPicked(source);
    getWebSocketClient().send('aiChoice', { proposalId: proposal.id, source, role: proposal.role });
  };

  return (
    <div style={panel} role="dialog" aria-label="Choose the AI detective's move">
      <div style={header}>
        <span style={title}>{proposal.role} · deciders disagree</span>
        <span style={hint}>{picked ? 'sent' : `heuristic in ${secondsLeft}s`}</span>
      </div>
      <div style={options}>
        {proposal.options.map((option) => (
          <OptionCard
            key={option.source}
            option={option}
            selected={picked === option.source}
            disabled={picked !== null}
            onPick={choose}
          />
        ))}
      </div>
    </div>
  );
}

function OptionCard({
  option,
  selected,
  disabled,
  onPick,
}: {
  option: AiProposalOption;
  selected: boolean;
  disabled: boolean;
  onPick: (source: AiDecisionSource) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(option.source)}
      disabled={disabled}
      style={{
        ...card,
        borderColor: selected ? COLOR.gold : COLOR.hairline,
        opacity: disabled && !selected ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span style={{ ...source, color: PROPOSAL_COLOR[option.source] }}>
        {LABEL[option.source]}
        {option.confidence != null && (
          <span style={{ color: COLOR.fg2 }}> · {(option.confidence * 100).toFixed(0)}% conf</span>
        )}
      </span>
      <span style={moveText}>
        {option.move.type} → {nodeDisplayName(option.move.position)}{' '}
        <span style={{ color: COLOR.fg2 }}>#{option.move.position}</span>
      </span>
    </button>
  );
}

const panel: React.CSSProperties = {
  position: 'fixed',
  bottom: 96,
  ...centeredX(),
  width: 'min(520px, calc(100vw - 32px))',
  background: COLOR.panel,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.card,
  boxShadow: SHADOW.dock,
  padding: 12,
  color: COLOR.fg,
  fontFamily: FONT.ui,
  zIndex: 25,
  transition: `left ${MOTION}`,
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 10,
};

const title: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' };
const hint: React.CSSProperties = { fontSize: 11, color: COLOR.fg2, fontFamily: FONT.mono };

const options: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  textAlign: 'left',
  background: COLOR.raised,
  border: '1px solid',
  borderRadius: RADIUS.cell,
  padding: '10px 12px',
  color: COLOR.fg,
  fontFamily: FONT.ui,
  transition: `border-color ${MOTION}, opacity ${MOTION}`,
};

const source: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' };
const moveText: React.CSSProperties = { fontSize: 14 };
