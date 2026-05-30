// Small bottom-right system controls: mute toggle, debug toggle (only renders when debug
// is enabled in preferences).

import { useRunnerStore } from '../stores/runner-store';

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
          opacity: debugEnabled ? 1 : 0.5,
          color: debugEnabled ? '#5a8dde' : '#fff',
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
  bottom: 22,
  right: 22,
  display: 'flex',
  gap: 6,
  zIndex: 5,
};

const iconButton: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  background: 'rgba(10, 12, 16, 0.78)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 16,
  backdropFilter: 'blur(6px)',
  transition: 'all 160ms ease',
  fontFamily: 'inherit',
};
