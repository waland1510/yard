// Graphics-quality control (#3). Cycles the FPV post-processing tier: auto → low → high.
// `auto` picks low on phones / high on desktops. Only shown while the FPV surface is active.

import { useRunnerStore, selectActiveSurface } from '../stores/runner-store';
import type { GraphicsQuality } from '../core/device-surface';
import { SCREEN_MARGIN, pillCompact } from './tokens';

const ORDER: GraphicsQuality[] = ['auto', 'low', 'high'];
const LABEL: Record<GraphicsQuality, string> = {
  auto: 'Auto',
  low: 'Low',
  high: 'High',
};

export function GraphicsToggle() {
  const activeSurface = useRunnerStore(selectActiveSurface);
  const quality = useRunnerStore((s) => s.graphicsQuality);
  const setGraphicsQuality = useRunnerStore((s) => s.setGraphicsQuality);

  if (activeSurface !== 'fpv') return null;

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(quality) + 1) % ORDER.length];
    setGraphicsQuality(next);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      style={btn}
      title="Graphics quality (auto / low / high)"
      aria-label={`Graphics quality: ${LABEL[quality]}`}
    >
      ✦ {LABEL[quality]}
    </button>
  );
}

const btn: React.CSSProperties = {
  ...pillCompact,
  position: 'fixed',
  bottom: SCREEN_MARGIN,
  left: SCREEN_MARGIN,
  zIndex: 30,
};
