// Floating control to flip between the immersive FPV surface and the strategic map.
// The active surface defaults from device class (phone → FPV, desktop → map); this
// toggle is the manual override (#2) and persists the choice for the session.

import { useRunnerStore, selectActiveSurface } from '../stores/runner-store';

export function SurfaceToggle() {
  const activeSurface = useRunnerStore(selectActiveSurface);
  const toggleSurface = useRunnerStore((s) => s.toggleSurface);

  // Label describes the surface you'd switch TO.
  const goingToFpv = activeSurface === 'map';
  const label = goingToFpv ? 'Street view' : 'Strategic map';
  const icon = goingToFpv ? '🚕' : '🗺️';

  return (
    <button
      type="button"
      onClick={toggleSurface}
      style={btn}
      aria-label={`Switch to ${label.toLowerCase()}`}
      title={`Switch to ${label.toLowerCase()}`}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const btn: React.CSSProperties = {
  position: 'fixed',
  top: 14,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 30,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  background: 'rgba(18, 20, 26, 0.72)',
  color: '#f2f4f8',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.4,
  borderRadius: 22,
  border: '1px solid rgba(255,255,255,0.18)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  backdropFilter: 'blur(8px)',
  cursor: 'pointer',
};
