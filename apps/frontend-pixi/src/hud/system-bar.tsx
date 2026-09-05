// Small bottom-right system controls: mute toggle, debug toggle (only renders when debug
// is enabled in preferences).

import { useRunnerStore } from '../stores/runner-store';
import { COLOR, SCREEN_MARGIN, iconSquare } from './tokens';

export function SystemBar() {
  const muted = useRunnerStore((s) => s.muted);
  const setMuted = useRunnerStore((s) => s.setMuted);
  const debugEnabled = useRunnerStore((s) => s.debugEnabled);
  const setDebugEnabled = useRunnerStore((s) => s.setDebugEnabled);

  return (
    <div style={container}>
      <button
        style={iconButton}
        onClick={() => setMuted(!muted)}
        title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <button
        style={{
          ...iconButton,
          opacity: debugEnabled ? 1 : 0.6,
          color: debugEnabled ? COLOR.blueTint : COLOR.fg2,
        }}
        onClick={() => setDebugEnabled(!debugEnabled)}
        title="Toggle debug overlay (Ctrl+D)"
        aria-label="Toggle debug"
      >
        🔍
      </button>
    </div>
  );
}

const container: React.CSSProperties = {
  position: 'fixed',
  bottom: SCREEN_MARGIN,
  right: SCREEN_MARGIN,
  display: 'flex',
  gap: 6,
  zIndex: 30,
};

const iconButton: React.CSSProperties = {
  ...iconSquare,
  background: COLOR.pill,
  border: 0,
  color: '#fff',
};
