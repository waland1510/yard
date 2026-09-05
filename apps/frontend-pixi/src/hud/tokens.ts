// HUD design tokens (from the "unified dock" handoff). Every floating HUD element reads
// from here so panels, pills, chips and type stay one system across FPV and map surfaces.
//
// The dock publishes `--hud-shift` on <html>: half the horizontal space it occupies.
// Centered overlays add it to `left: 50%` so they float over the free map area and glide
// with the dock as it collapses (see `centeredX`).

import type { CSSProperties } from 'react';
import type { TransportKind } from '../game/connections';

export const COLOR = {
  panel: '#17191e',
  raised: '#1f222a',
  pill: '#2b2e36',
  pillHover: '#353945',
  hairline: 'rgba(255,255,255,.08)',
  fg: '#f0ede6',
  fg2: '#9aa0ab',
  gold: '#e8b64c',
  goldHover: '#f2c563',
  onGold: '#231d0e',
  red: '#e05545',
  redTint: '#f08a7c',
  blue: '#4f8fd8',
  blueTint: '#8db8e8',
  green: '#3e9e5f',
  greenTint: '#7fcf9a',
  purple: '#9a6fd8',
  purpleTint: '#c9a0e8',
  avatarBg: '#262a33',
} as const;

export const FONT = {
  ui: "'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

export const RADIUS = {
  dock: 18,
  card: 13,
  cell: 11,
  control: 10,
  chip: 6,
  tag: 5,
  pill: 999,
} as const;

export const SHADOW = {
  dock: '0 8px 40px rgba(0,0,0,.35)',
  pillLight: '0 2px 14px rgba(0,0,0,.18)',
  pillDark: '0 3px 14px rgba(0,0,0,.25)',
} as const;

export const MOTION = '.28s cubic-bezier(.5,0,.2,1)';

export const SCREEN_MARGIN = 16;
export const DOCK_WIDTH = 340;
export const DOCK_RAIL_WIDTH = 64;

/** Player accent colours. Transport chips stay board-consistent (taxi gold, bus green,
 *  tube red) rather than the handoff's chip palette so the dock matches the map legend. */
export const PLAYER_COLOR: Record<string, string> = {
  detective1: '#4f8fd8',
  detective2: '#d8637f',
  detective3: '#9a6fd8',
  detective4: '#3e9e5f',
  detective5: '#d89a4f',
  culprit: '#e05545',
};

export interface ChipTone {
  color: string;
  border: string;
}

export const TRANSPORT_CHIP: Record<TransportKind | 'secret' | 'double', ChipTone> = {
  taxi: { color: '#e8b64c', border: 'rgba(232,182,76,.4)' },
  bus: { color: '#7fcf9a', border: 'rgba(62,158,95,.45)' },
  underground: { color: '#f08a7c', border: 'rgba(224,85,69,.4)' },
  river: { color: '#8db8e8', border: 'rgba(79,143,216,.4)' },
  secret: { color: '#c9a0e8', border: 'rgba(168,127,196,.45)' },
  double: { color: '#9aa0ab', border: 'rgba(255,255,255,.2)' },
};

/** Horizontal centring over the free map area. Pair with `top`/`bottom` and `position`. */
export function centeredX(extraTransform = ''): CSSProperties {
  return {
    left: 'calc(50% + var(--hud-shift, 0px))',
    transform: `translateX(-50%) ${extraTransform}`.trim(),
    transition: `left ${MOTION}`,
  };
}

export const pillDark: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  background: COLOR.pill,
  color: '#fff',
  border: 0,
  borderRadius: RADIUS.pill,
  padding: '11px 20px',
  font: `600 14px ${FONT.ui}`,
  boxShadow: SHADOW.pillDark,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export const pillLight: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#fff',
  color: '#333',
  border: 0,
  borderRadius: RADIUS.pill,
  padding: '9px 16px',
  font: `600 13px ${FONT.ui}`,
  boxShadow: '0 2px 12px rgba(0,0,0,.16)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export const pillCompact: CSSProperties = {
  ...pillDark,
  padding: '7px 14px',
  font: `600 12.5px ${FONT.ui}`,
  gap: 8,
};

export const monoCount: CSSProperties = {
  font: `600 12px ${FONT.mono}`,
  color: COLOR.gold,
};

export const iconSquare: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: RADIUS.control,
  border: `1px solid ${COLOR.hairline}`,
  background: COLOR.raised,
  color: COLOR.fg2,
  cursor: 'pointer',
  fontSize: 15,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONT.ui,
  boxShadow: SHADOW.pillDark,
};
