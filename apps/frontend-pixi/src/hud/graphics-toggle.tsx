// Graphics-quality control (#3). Cycles the FPV post-processing tier: auto → low → high.
// `auto` picks low on phones / high on desktops. Only shown while the FPV surface is active.

import { useRunnerStore, selectActiveSurface } from '../stores/runner-store';
import type { GraphicsQuality } from '../core/device-surface';

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
  position: 'fixed',
  bottom: 18,
  left: 14,
  zIndex: 30,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: 'rgba(18, 20, 26, 0.72)',
  color: '#f2f4f8',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.18)',
  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
  backdropFilter: 'blur(8px)',
  cursor: 'pointer',
};
