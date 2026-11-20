// Small bottom-right system controls: rules, mute toggle, debug toggle.

import { useRunnerStore } from '../stores/runner-store';
import { useGameStateStore } from '../stores/game-state-store';
import { RulesButton } from './rules-panel';
import { COLOR, SCREEN_MARGIN, TAP, iconSquare } from './tokens';

const BUTTON_COUNT = 3;
const GAP = 6;
/** Horizontal space the bar occupies (a CSS length), so neighbouring bottom-right controls can clear it. */
export const SYSTEM_BAR_WIDTH = `(${TAP} * ${BUTTON_COUNT} + ${GAP * (BUTTON_COUNT - 1)}px)`;

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
            <BookIcon />
          </button>
        )}
      />
      <button
        style={iconButton}
        onClick={() => setMuted(!muted)}
        title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
        aria-label="Mute sound effects"
        aria-pressed={muted}
      >
        <SpeakerIcon muted={muted} />
      </button>
      <button
        style={{
          ...iconButton,
          boxShadow: debugEnabled ? `0 0 0 1.5px ${COLOR.blueTint} inset` : iconSquare.boxShadow,
        }}
        onClick={() => setDebugEnabled(!debugEnabled)}
        title="Toggle debug overlay (Ctrl+D)"
        aria-label="Debug overlay"
        aria-pressed={debugEnabled}
      >
        <InspectIcon />
      </button>
    </div>
  );
}

const ICON_PROPS = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function BookIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-14c-4 0-6.5.5-8 2z" />
      <path d="M12 6.5v14" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4z" />
      {muted ? (
        <path d="M16 9.5l5 5m0-5l-5 5" />
      ) : (
        <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
      )}
    </svg>
  );
}

function InspectIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </svg>
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
  color: COLOR.fg,
};
