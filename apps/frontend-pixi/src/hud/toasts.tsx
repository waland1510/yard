// Renders the notification-service queue as a stack of toasts under the top HUD.
// Click a toast to dismiss it early.

import { useSyncExternalStore } from 'react';
import { notifications, type NotificationKind } from '../core/notification-service';
import { COLOR, FONT, RADIUS, SHADOW, centeredX } from './tokens';

const ACCENT: Record<NotificationKind, string> = {
  info: COLOR.blueTint,
  success: '#6fcf8e',
  warning: COLOR.gold,
  error: COLOR.red,
  capture: COLOR.redTint,
  reveal: COLOR.redTint,
};

const ICON: Record<NotificationKind, string> = {
  info: 'ℹ︎',
  success: '✓',
  warning: '!',
  error: '✕',
  capture: '★',
  reveal: '◉',
};

export function Toasts() {
  const queue = useSyncExternalStore(notifications.subscribe, notifications.list);
  if (queue.length === 0) return null;
  return (
    <div style={stack} role="status" aria-live="polite">
      {queue.slice(-4).map((n) => (
        <button
          key={n.id}
          type="button"
          style={{ ...toast, borderLeft: `3px solid ${ACCENT[n.kind]}` }}
          onClick={() => notifications.dismiss(n.id)}
          title="Dismiss"
        >
          <span style={{ ...icon, color: ACCENT[n.kind] }}>{ICON[n.kind]}</span>
          <span>{n.message}</span>
        </button>
      ))}
    </div>
  );
}

const stack: React.CSSProperties = {
  position: 'fixed',
  // Below the turn banner (top 118, ~46px tall) so a toast never hides under it.
  top: 176,
  ...centeredX(),
  zIndex: 45,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  pointerEvents: 'none',
  maxWidth: 'calc(100vw - 32px)',
};

const toast: React.CSSProperties = {
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  maxWidth: 420,
  padding: '9px 14px',
  background: COLOR.panel,
  color: COLOR.fg,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: RADIUS.card,
  boxShadow: SHADOW.pillDark,
  font: `500 13px ${FONT.ui}`,
  textAlign: 'left',
  cursor: 'pointer',
  animation: 'sy-toast-in .22s ease-out',
};

const icon: React.CSSProperties = { fontWeight: 800, width: 14, textAlign: 'center', flexShrink: 0 };
