// Small "Copy invite link" button — bottom-left corner. Copies a shareable URL
// (no role/name) to the clipboard so anyone with the link can join.

import { useState } from 'react';
import { useGameStateStore } from '../stores/game-state-store';
import { notifications } from '../core/notification-service';

export function InviteButton() {
  const channel = useGameStateStore((s) => s.channel);
  const [copied, setCopied] = useState(false);

  // Skip during mock-mode games — the link wouldn't work for anyone else
  if (!channel || channel === 'mock' || channel.startsWith('mock-')) return null;

  const inviteUrl = `${window.location.origin}/game/${encodeURIComponent(channel)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      notifications.push('success', 'Invite link copied');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      notifications.push('error', 'Could not copy link');
    }
  };

  return (
    <button
      type="button"
      style={{
        ...container,
        background: copied ? 'rgba(16, 185, 129, 0.85)' : 'rgba(10, 12, 16, 0.78)',
        borderColor: copied ? '#10b981' : 'rgba(255,255,255,0.18)',
      }}
      onClick={copy}
      title="Share this link so others can join the same game"
    >
      <span style={{ fontSize: 14 }}>{copied ? '✓' : '🔗'}</span>
      <span style={label}>{copied ? 'Copied' : 'Invite'}</span>
      <span style={chip}>{channel}</span>
    </button>
  );
}

const container: React.CSSProperties = {
  position: 'fixed',
  bottom: 22,
  left: 22,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  border: '1px solid',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  zIndex: 6,
  backdropFilter: 'blur(6px)',
  fontFamily: 'inherit',
  fontSize: 12,
  transition: 'all 160ms ease',
};

const label: React.CSSProperties = {
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontWeight: 700,
};

const chip: React.CSSProperties = {
  padding: '2px 6px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: 4,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 11,
  letterSpacing: 1,
  color: 'rgba(255,255,255,0.85)',
};
