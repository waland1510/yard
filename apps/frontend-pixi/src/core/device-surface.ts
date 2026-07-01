// Device-surface resolution. Decides which surface (immersive FPV vs strategic map) a
// device should show by default, given its hardware class, the user's explicit view-mode
// override, and — when companion pairing lands (#1) — its assigned surface role.
//
// The resolution logic is PURE (`resolveSurface`, `deviceTypeFromProfile`) so it can be
// unit-tested without a browser. `detectDeviceProfile()` is the only browser-touching
// helper and is guarded for non-DOM (test / SSR) environments.

/** The two rendering surfaces a player can be looking at. */
export type Surface = 'fpv' | 'map';

/** Hardware class. `phone` → immersive FPV by default; `desktop` → strategic map. */
export type DeviceType = 'desktop' | 'phone';

/**
 * The local viewer's surface preference.
 * - `auto`  — resolve from device class (+ pairing role once paired).
 * - `fpv` / `map` — an explicit manual override that wins over `auto`.
 */
export type ViewMode = 'auto' | 'fpv' | 'map';

/** Role a device plays within a paired companion session (introduced in #1). */
export type SurfaceRole = 'controller' | 'viewer';

/** Companion pairing state, as far as surface resolution cares about it. */
export interface PairingState {
  /** Which surface this device drives in the pair. `null` while unpaired. */
  surfaceRole: SurfaceRole | null;
}

/** Snapshot of the device's input/viewport characteristics. */
export interface DeviceProfile {
  /** A touch-capable pointer is present (e.g. `(pointer: coarse)`). */
  isCoarsePointer: boolean;
  /** The device reports touch points / a touch event surface. */
  isTouch: boolean;
  /** Viewport width in CSS pixels. */
  viewportWidth: number;
}

/** Below this CSS width, a coarse-pointer touch device is treated as a phone. */
const PHONE_MAX_WIDTH = 900;

/** User's FPV graphics preference. `auto` picks a tier from the device class. */
export type GraphicsQuality = 'auto' | 'low' | 'high';

/**
 * Resolve the concrete post-processing tier. `auto` → `low` on phones (preserve
 * framerate / battery) and `high` on desktops; an explicit choice is honoured as-is.
 */
export function resolveQualityTier(
  quality: GraphicsQuality,
  deviceType: DeviceType
): 'low' | 'high' {
  if (quality === 'low' || quality === 'high') return quality;
  return deviceType === 'phone' ? 'low' : 'high';
}

/**
 * Classify a device profile. A device is a `phone` only when it is genuinely
 * touch-first AND on a narrow viewport — this keeps large touch laptops and
 * desktops with touchscreens on the `desktop` (map-default) path.
 */
export function deviceTypeFromProfile(profile: DeviceProfile): DeviceType {
  const touchFirst = profile.isCoarsePointer && profile.isTouch;
  if (touchFirst && profile.viewportWidth < PHONE_MAX_WIDTH) return 'phone';
  return 'desktop';
}

/**
 * Resolve the active surface. Pure.
 *
 * Precedence:
 *   1. An explicit `viewMode` override (`fpv`/`map`) always wins.
 *   2. Otherwise, a paired `surfaceRole` decides (controller → fpv, viewer → map).
 *   3. Otherwise, fall back to the device class (phone → fpv, desktop → map).
 *
 * Unpaired solo devices always resolve to a usable surface via step 3.
 */
export function resolveSurface(input: {
  deviceType: DeviceType;
  viewMode: ViewMode;
  pairing?: PairingState | null;
}): Surface {
  const { deviceType, viewMode, pairing } = input;

  // (1) Manual override beats everything.
  if (viewMode === 'fpv' || viewMode === 'map') return viewMode;

  // (2) Paired role, when present.
  if (pairing?.surfaceRole === 'controller') return 'fpv';
  if (pairing?.surfaceRole === 'viewer') return 'map';

  // (3) Device-class default.
  return deviceType === 'phone' ? 'fpv' : 'map';
}

/**
 * True when touch is the device's PRIMARY input (coarse pointer + touch surface) — i.e.
 * pointer-lock mouse-look won't work and the FPV needs touch controls. Independent of
 * viewport width: a touchscreen tablet is touch-primary even on a wide screen.
 */
export function isTouchPrimary(profile: DeviceProfile): boolean {
  return profile.isCoarsePointer && profile.isTouch;
}

/**
 * Read the current device profile from the DOM. Returns a desktop-leaning default
 * outside a browser (tests / SSR) so callers never branch on `typeof window`.
 */
export function detectDeviceProfile(): DeviceProfile {
  if (typeof window === 'undefined') {
    return { isCoarsePointer: false, isTouch: false, viewportWidth: 1920 };
  }
  const isCoarsePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  const isTouch =
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  return {
    isCoarsePointer,
    isTouch,
    viewportWidth: window.innerWidth,
  };
}
