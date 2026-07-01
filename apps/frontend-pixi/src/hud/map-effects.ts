// Strategic-board visual effects (#4) — the legacy SVG map's situational-awareness polish,
// ported to the Google Maps board. Each effect spawns a self-animating google.maps.Circle
// and returns a cancel handle, so callers don't have to thread through a shared ticker.
//
//   - spawnSpotlight: one-shot expanding ring that fades out (reveal flourish / move land)
//   - spawnTrailDot:  a fading dot left behind at a player's previous node (movement trail)
//   - spawnPulse:     a looping pulse under a reachable destination (valid-move aura)
//
// All radii are in metres (Circle's native unit), tuned for the ~14-zoom London board.

export interface EffectHandle {
  cancel(): void;
}

interface LatLng {
  lat: number;
  lng: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface RingOpts {
  color: string;
  fromRadius: number;
  toRadius: number;
  fromOpacity: number;
  toOpacity: number;
  durationMs: number;
  /** Loop the animation (ping-pong) until cancelled — used for the valid-move pulse. */
  loop?: boolean;
  /** Stroke instead of fill (rings read better for spotlights). */
  stroke?: boolean;
  zIndex?: number;
}

/** Core animated ring. Returns a handle that stops the rAF loop and removes the circle. */
function spawnRing(map: google.maps.Map, center: LatLng, opts: RingOpts): EffectHandle {
  const circle = new google.maps.Circle({
    map,
    center,
    radius: opts.fromRadius,
    strokeColor: opts.color,
    strokeOpacity: opts.stroke ? opts.fromOpacity : 0,
    strokeWeight: opts.stroke ? 2.5 : 0,
    fillColor: opts.color,
    fillOpacity: opts.stroke ? 0 : opts.fromOpacity,
    clickable: false,
    zIndex: opts.zIndex ?? 1,
  });

  let raf = 0;
  let start = performance.now();
  let cancelled = false;

  const frame = (now: number) => {
    if (cancelled) return;
    const elapsed = now - start;
    let p = Math.min(1, elapsed / opts.durationMs);
    const e = easeOutCubic(opts.loop ? (p < 0.5 ? p * 2 : (1 - p) * 2) : p);
    const radius = opts.fromRadius + (opts.toRadius - opts.fromRadius) * e;
    const opacity = opts.fromOpacity + (opts.toOpacity - opts.fromOpacity) * e;
    circle.setRadius(radius);
    if (opts.stroke) circle.setOptions({ strokeOpacity: Math.max(0, opacity) });
    else circle.setOptions({ fillOpacity: Math.max(0, opacity) });

    if (p >= 1) {
      if (opts.loop) {
        start = now;
        p = 0;
      } else {
        cleanup();
        return;
      }
    }
    raf = requestAnimationFrame(frame);
  };

  function cleanup() {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    circle.setMap(null);
  }

  raf = requestAnimationFrame(frame);
  return { cancel: cleanup };
}

/** Expanding ring that fades out — reveal flourish or move-landing emphasis. */
export function spawnSpotlight(
  map: google.maps.Map,
  center: LatLng,
  color: string,
  maxRadius = 320
): EffectHandle {
  return spawnRing(map, center, {
    color,
    fromRadius: 20,
    toRadius: maxRadius,
    fromOpacity: 0.9,
    toOpacity: 0,
    durationMs: 1600,
    stroke: true,
    zIndex: 50,
  });
}

/** A fading dot left at a previous position (movement trail breadcrumb). */
export function spawnTrailDot(map: google.maps.Map, center: LatLng, color: string): EffectHandle {
  return spawnRing(map, center, {
    color,
    fromRadius: 40,
    toRadius: 18,
    fromOpacity: 0.55,
    toOpacity: 0,
    durationMs: 1400,
    zIndex: 3,
  });
}

/** A looping pulse under a reachable destination (valid-move aura). `urgent` warms the
 *  colour for a low ticket count. */
export function spawnPulse(map: google.maps.Map, center: LatLng, color: string): EffectHandle {
  return spawnRing(map, center, {
    color,
    fromRadius: 30,
    toRadius: 90,
    fromOpacity: 0.5,
    toOpacity: 0.05,
    durationMs: 1100,
    loop: true,
    stroke: true,
    zIndex: 9,
  });
}
