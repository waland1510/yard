// CanvasTexture helpers used by stops + streetscape for glyphs / logos / patterns.
// Every texture is appended to a single in-module disposables list; call
// disposeAllCanvasTextures() during scene teardown to release them. Each builder also
// passes the texture into the intersection's `addMat`-style collector via the helper
// `registerForDispose` argument so per-build cleanup works through the same path.

import * as THREE from 'three';

export interface CanvasTextureOpts {
  size?: number; // square size (default 512)
  width?: number;
  height?: number;
  anisotropy?: number;
}

function makeCanvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function finalize(canvas: HTMLCanvasElement, anisotropy = 4) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeTextTexture(
  text: string,
  opts: {
    width?: number;
    height?: number;
    bg?: string;
    fg?: string;
    fontPx?: number;
    fontFamily?: string;
    fontWeight?: string;
    border?: string;
    rotateDeg?: number;
  } = {}
): THREE.CanvasTexture {
  const width = opts.width ?? 512;
  const height = opts.height ?? 256;
  const c = makeCanvas(width, height);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = opts.bg ?? '#000';
  ctx.fillRect(0, 0, width, height);
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = Math.max(4, height * 0.04);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
  }
  ctx.fillStyle = opts.fg ?? '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontPx = opts.fontPx ?? Math.floor(height * 0.62);
  ctx.font = `${opts.fontWeight ?? '700'} ${fontPx}px ${opts.fontFamily ?? 'Helvetica, Arial, sans-serif'}`;
  if (opts.rotateDeg) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((opts.rotateDeg * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(text, width / 2, height / 2 + fontPx * 0.04);
  }
  return finalize(c);
}

/** TfL roundel: red ring with optional blue horizontal bar carrying lettering. */
export function makeRoundelTexture(opts: {
  ringColor?: string;
  barColor?: string;
  barText?: string;
  size?: number;
} = {}): THREE.CanvasTexture {
  const size = opts.size ?? 512;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  // White disc background (so the texture's negative space reads white, not transparent
  // black, on a double-sided plane)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fill();
  // Red ring
  ctx.strokeStyle = opts.ringColor ?? '#dc241f';
  ctx.lineWidth = size * 0.13;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  // Blue bar
  const barH = size * 0.2;
  ctx.fillStyle = opts.barColor ?? '#0019a8';
  ctx.fillRect(0, size / 2 - barH / 2, size, barH);
  // Optional bar text
  if (opts.barText) {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.floor(barH * 0.62)}px Helvetica, Arial, sans-serif`;
    ctx.fillText(opts.barText, size / 2, size / 2);
  }
  return finalize(c);
}

/** Black-and-yellow chequered band (taxi). cols: number of squares across, height in px. */
export function makeChequerTexture(
  cols = 32,
  rows = 2,
  colorA = '#1a1a1c',
  colorB = '#f6c945'
): THREE.CanvasTexture {
  const cell = 16;
  const c = makeCanvas(cols * cell, rows * cell);
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  return finalize(c, 1);
}

/** "PIER" sign style: cream plate with name + wavy blue band beneath. */
export function makePierSignTexture(name: string): THREE.CanvasTexture {
  const w = 512;
  const h = 200;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1a1a1c';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = '#1a1a1c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 64px "Times New Roman", serif`;
  ctx.fillText(name, w / 2, h * 0.4);
  // Wavy blue band
  ctx.fillStyle = '#0019a8';
  const baseY = h * 0.78;
  const amp = 8;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  for (let x = 0; x <= w; x += 4) {
    const y = baseY + Math.sin(x * 0.05) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  return finalize(c);
}

/** Vertical black-and-white stripe band for Belisha beacon poles. */
export function makeBeaconStripeTexture(): THREE.CanvasTexture {
  const w = 64;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const bands = 6;
  const bandH = h / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1a1a1c' : '#f4efe2';
    ctx.fillRect(0, i * bandH, w, bandH);
  }
  return finalize(c, 1);
}

/** Route flag plate (white background, three route numbers stacked, black border). */
export function makeRouteFlagTexture(routes: readonly (string | number)[]): THREE.CanvasTexture {
  const w = 256;
  const h = 320;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1a1a1c';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = '#1a1a1c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const slotH = h / routes.length;
  for (let i = 0; i < routes.length; i++) {
    const fontPx = Math.min(Math.floor(slotH * 0.65), 96);
    ctx.font = `800 ${fontPx}px Helvetica, Arial, sans-serif`;
    ctx.fillText(String(routes[i]), w / 2, slotH * (i + 0.5));
  }
  return finalize(c);
}

/** Station-name lintel band for the Underground arch. */
export function makeStationLintelTexture(name: string): THREE.CanvasTexture {
  const w = 1024;
  const h = 200;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1a1a1c';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = '#1a1a1c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 130px Helvetica, Arial, sans-serif`;
  ctx.fillText(name, w / 2, h / 2 + 8);
  return finalize(c);
}

// ---------------------------------------------------------------------------
// Surface textures. Shared across rebuilds (module cache) — never pushed into a
// per-intersection dispose list.
// ---------------------------------------------------------------------------

const surfaceCache = new Map<string, THREE.CanvasTexture>();

function cachedSurface(key: string, make: () => HTMLCanvasElement, anisotropy = 8): THREE.CanvasTexture {
  const hit = surfaceCache.get(key);
  if (hit) return hit;
  const tex = finalize(make(), anisotropy);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  surfaceCache.set(key, tex);
  return tex;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, rng: () => number, alpha: number, size = 2) {
  for (let i = 0; i < count; i++) {
    const v = rng();
    ctx.fillStyle = v < 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(rng() * w, rng() * h, size * (0.5 + rng()), size * (0.5 + rng()));
  }
}

/** Worn asphalt: one tile spans ~8 m. */
export function makeAsphaltTexture(): THREE.CanvasTexture {
  return cachedSurface('asphalt', () => {
    const size = 512;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const rng = seeded(1234);
    ctx.fillStyle = '#3e4147';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(20,22,26,0.18)' : 'rgba(90,94,100,0.12)';
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 40 + rng() * 120, 20 + rng() * 60, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, size, size, 9000, rng, 0.08, 2);
    speckle(ctx, size, size, 1500, rng, 0.16, 1);
    return c;
  });
}

/** York-stone paving slabs: one tile spans ~4 m (slabs ~0.66 m). */
export function makePavingTexture(): THREE.CanvasTexture {
  return cachedSurface('paving', () => {
    const size = 512;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const rng = seeded(777);
    const cols = 6;
    const rows = 6;
    const cw = size / cols;
    const rh = size / rows;
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cw / 2);
      for (let col = -1; col < cols + 1; col++) {
        const tone = 128 + Math.floor((rng() - 0.5) * 26);
        ctx.fillStyle = `rgb(${tone + 6},${tone},${tone - 10})`;
        ctx.fillRect(col * cw + offset, r * rh, cw, rh);
      }
    }
    ctx.strokeStyle = 'rgba(40,36,30,0.55)';
    ctx.lineWidth = 3;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * rh);
      ctx.lineTo(size, r * rh);
      ctx.stroke();
      const offset = (r % 2) * (cw / 2);
      for (let col = 0; col <= cols; col++) {
        ctx.beginPath();
        ctx.moveTo(col * cw + offset, r * rh);
        ctx.lineTo(col * cw + offset, (r + 1) * rh);
        ctx.stroke();
      }
    }
    speckle(ctx, size, size, 5000, rng, 0.07, 2);
    return c;
  });
}

/** Mown lawn: one tile spans ~6 m. */
export function makeGrassTexture(): THREE.CanvasTexture {
  return cachedSurface('grass', () => {
    const size = 256;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d')!;
    const rng = seeded(4242);
    ctx.fillStyle = '#4c7a37';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(112,160,70,0.35)' : 'rgba(40,74,30,0.35)';
      ctx.fillRect(rng() * size, rng() * size, 2, 4 + rng() * 6);
    }
    return c;
  });
}

const FASCIA_COLORS = ['#1f4d3a', '#5a1f24', '#1e2f57', '#2b2b2e', '#6a3d1f'];

function shade(hexColor: string, amount: number): string {
  const n = parseInt(hexColor.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = ch(((n >> 16) & 255) * amount);
  const g = ch(((n >> 8) & 255) * amount);
  const b = ch((n & 255) * amount);
  return `rgb(${r},${g},${b})`;
}

/**
 * A terraced-house facade: ground floor with shopfront + fascia, `floors` upper storeys
 * of sash windows (some lit), string courses, cornice. Sized so that one texture maps to
 * exactly one building face — `cols` windows across, `floors` storeys up.
 */
export function makeFacadeTexture(cols: number, floors: number, wallHex: string, variant: number): THREE.CanvasTexture {
  const key = `facade-${cols}-${floors}-${wallHex}-${variant}`;
  return cachedSurface(key, () => {
    const cellW = 128;
    const groundH = 160;
    const floorH = 128;
    const w = Math.max(1, cols) * cellW;
    const h = groundH + Math.max(0, floors) * floorH;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d')!;
    const rng = seeded(cols * 7919 + floors * 104729 + variant * 31 + wallHex.length);

    ctx.fillStyle = wallHex;
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, Math.floor((w * h) / 90), rng, 0.05, 3);

    // Cornice + parapet band at the very top
    ctx.fillStyle = shade(wallHex, 1.25);
    ctx.fillRect(0, 0, w, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 14, w, 4);

    // Upper storeys (drawn top-down; row 0 is the top floor)
    for (let f = 0; f < floors; f++) {
      const y0 = 18 + f * floorH;
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(0, y0 + floorH - 3, w, 3);
      for (let col = 0; col < cols; col++) {
        const x0 = col * cellW;
        const wx = x0 + 34;
        const wy = y0 + 26;
        const ww = 60;
        const wh = 82;
        ctx.fillStyle = shade(wallHex, 1.35);
        ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(wx - 6, wy + wh + 6, ww + 12, 5);
        const lit = rng() < 0.16;
        const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
        if (lit) {
          g.addColorStop(0, '#f6dc9c');
          g.addColorStop(1, '#d9b070');
        } else {
          g.addColorStop(0, '#5b6b80');
          g.addColorStop(0.5, '#2e3644');
          g.addColorStop(1, '#232a36');
        }
        ctx.fillStyle = g;
        ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = shade(wallHex, 1.5);
        ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh);
        ctx.fillRect(wx, wy + wh / 2 - 2, ww, 4);
      }
    }

    // Ground floor: plinth, shopfront glazing, fascia sign
    const gy = h - groundH;
    ctx.fillStyle = shade(wallHex, 0.8);
    ctx.fillRect(0, gy, w, groundH);
    ctx.fillStyle = FASCIA_COLORS[variant % FASCIA_COLORS.length];
    ctx.fillRect(0, gy + 6, w, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, gy + 34, w, 3);
    for (let col = 0; col < cols; col++) {
      const x0 = col * cellW;
      const isDoor = cols > 1 && col === Math.floor(cols / 2) && variant % 2 === 0;
      const g = ctx.createLinearGradient(0, gy + 44, 0, h - 14);
      g.addColorStop(0, isDoor ? '#3a2a1e' : '#6c7f96');
      g.addColorStop(1, isDoor ? '#241a12' : '#2c3542');
      ctx.fillStyle = g;
      ctx.fillRect(x0 + 16, gy + 44, cellW - 32, groundH - 58);
      ctx.fillStyle = shade(wallHex, 0.55);
      ctx.fillRect(x0 + 10, gy + 40, 6, groundH - 50);
      ctx.fillRect(x0 + cellW - 16, gy + 40, 6, groundH - 50);
    }
    ctx.fillStyle = '#3a3a3c';
    ctx.fillRect(0, h - 14, w, 14);
    return c;
  });
}
