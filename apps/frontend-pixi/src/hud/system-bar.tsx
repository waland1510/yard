// Small bottom-right system controls: rules, mute toggle, debug toggle.

import { useRunnerStore } from '../stores/runner-store';
import { useGameStateStore } from '../stores/game-state-store';
import { RulesButton } from './rules-panel';
import { COLOR, SCREEN_MARGIN, iconSquare } from './tokens';

const BUTTON_COUNT = 3;
const GAP = 6;
/** Horizontal space the bar occupies, so neighbouring bottom-right controls can clear it. */
export const SYSTEM_BAR_WIDTH = 36 * BUTTON_COUNT + GAP * (BUTTON_COUNT - 1);

export function SystemBar() {
  const muted = useRunnerStore((s) => s.muted);
  const setMuted = useRunnerStore((s) => s.setMuted);
  const debugEnabled = useRunnerStore((s) => s.debugEnabled);
  const setDebugEnabled = useRunnerStore((s) => s.setDebugEnabled);
  const themeId = useGameStateStore((s) => s.theme);

  return (
    <div style={container}>
      <RulesButton
        themeId={themeId}
        renderTrigger={(open) => (
          <button style={iconButton} onClick={open} title="How to play" aria-label="Game rules">
            📖
          </button>
        )}
      />
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
  gap: GAP,
  zIndex: 30,
};

const iconButton: React.CSSProperties = {
  ...iconSquare,
  background: COLOR.pill,
  border: 0,
  color: '#fff',
};
