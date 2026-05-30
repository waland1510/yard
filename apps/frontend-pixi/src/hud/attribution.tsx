// Google Photorealistic 3D Tiles attribution overlay. Per Google Maps Platform terms
// of service this MUST be visible and unobscured whenever Google tile imagery is on
// screen. Renders the small "Google" wordmark + aggregated per-tile copyright string
// at the bottom-left of the canvas.

import { useEffect, useState } from 'react';
import type { Tileset } from '../three/tileset';

interface Props {
  tileset: Tileset | null;
}

export function Attribution({ tileset }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!tileset) return;
    let stop = false;
    const tick = () => {
      if (stop) return;
      const t = tileset.getAttribution();
      setText((prev) => (prev === t ? prev : t));
    };
    tick();
    const id = window.setInterval(tick, 750);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [tileset]);

  if (!tileset) return null;

  return (
    <div style={bar}>
      <span style={brand}>Google</span>
      {text && <span style={meta}>· {text}</span>}
    </div>
  );
}

const bar: React.CSSProperties = {
  position: 'fixed',
  left: 12,
  bottom: 8,
  zIndex: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  background: 'rgba(0,0,0,0.55)',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 11,
  borderRadius: 4,
  pointerEvents: 'none',
  maxWidth: '70vw',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const brand: React.CSSProperties = {
  fontWeight: 700,
  letterSpacing: 0.4,
};

const meta: React.CSSProperties = {
  color: 'rgba(255,255,255,0.75)',
};
