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
