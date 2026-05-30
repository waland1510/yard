export function makeRng(seed: number) {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickFloat(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min);
}

export function pickInt(rng: () => number, min: number, maxExclusive: number) {
  return min + Math.floor(rng() * (maxExclusive - min));
}

export function pickFrom<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
