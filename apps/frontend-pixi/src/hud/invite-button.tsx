// Small "Copy invite link" button — bottom-left corner. Copies a shareable URL
// (no role/name) to the clipboard so anyone with the link can join.

import { useState } from 'react';
import { useGameStateStore } from '../stores/game-state-store';
import { notifications } from '../core/notification-service';
import { COLOR, FONT, SCREEN_MARGIN, pillCompact } from './tokens';

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
        background: copied ? COLOR.green : COLOR.pill,
      }}
      onClick={copy}
      title="Share this link so others can join the same game"
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{copied ? '✓' : '🔗'}</span>
      <span style={label}>{copied ? 'Copied' : 'Invite'}</span>
      <span style={chip}>{channel}</span>
    </button>
  );
}

const container: React.CSSProperties = {
  ...pillCompact,
  position: 'fixed',
  bottom: SCREEN_MARGIN,
  right: SCREEN_MARGIN + 36 * 2 + 6 + 8,
  height: 36,
  zIndex: 30,
};

const label: React.CSSProperties = {};

const chip: React.CSSProperties = {
  font: `600 11px ${FONT.mono}`,
  letterSpacing: '.06em',
  color: COLOR.gold,
};
