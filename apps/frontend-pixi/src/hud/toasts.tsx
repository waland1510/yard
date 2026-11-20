// Renders the notification-service queue as a stack of toasts under the top HUD.
// Click a toast to dismiss it early.

import { useSyncExternalStore } from 'react';
import { notifications, type NotificationKind } from '../core/notification-service';
import { COLOR, FONT, RADIUS, SHADOW, centeredX } from './tokens';
import { useNarrowViewport } from './use-viewport';

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
  const narrow = useNarrowViewport();
  if (queue.length === 0) return null;
  return (
    <div style={narrow ? stackNarrow : stack} role="status" aria-live="polite">
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

// Phone: the turn banner drops below the map's button column, so toasts follow it down.
const STACK_TOP_NARROW = 250;

const stack: React.CSSProperties = {
  position: 'fixed',
  // Below the turn banner (top 152, ~46px tall) so a toast never hides under it.
  top: 210,
  ...centeredX(),
  zIndex: 45,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  pointerEvents: 'none',
  maxWidth: 'calc(100vw - 32px)',
};

const stackNarrow: React.CSSProperties = { ...stack, top: STACK_TOP_NARROW };

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
