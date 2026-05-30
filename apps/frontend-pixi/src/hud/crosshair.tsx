import { VehicleKind } from '../three/vehicles';

interface CrosshairProps {
  pointerLocked: boolean;
  hoveredKind: VehicleKind | null;
  hidden: boolean;
}

const KIND_COLOR: Record<VehicleKind, string> = {
  taxi: '#f6c945',
  bus: '#e25555',
  underground: '#5a8dde',
  river: '#6cb8d6',
};

export function Crosshair({ pointerLocked, hoveredKind, hidden }: CrosshairProps) {
  if (hidden || !pointerLocked) return null;
  const color = hoveredKind ? KIND_COLOR[hoveredKind] : 'rgba(255,255,255,0.7)';
  const size = hoveredKind ? 22 : 14;
  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderRadius: hoveredKind ? '50%' : '2px',
        boxShadow: hoveredKind ? `0 0 12px ${color}` : 'none',
        pointerEvents: 'none',
        transition: 'all 120ms ease',
        zIndex: 5,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 3,
          height: 3,
          background: color,
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
