export type SfxKey =
  | 'taxi'
  | 'bus'
  | 'underground'
  | 'river'
  | 'secret'
  | 'double'
  | 'shadow'
  | 'reveal'
  | 'capture';

const SFX_FILES: Record<SfxKey, string> = {
  taxi: '/sounds/taxi.mp3',
  bus: '/sounds/bus.mp3',
  underground: '/sounds/underground.mp3',
  river: '/sounds/river.mp3',
  secret: '/sounds/secret.mp3',
  double: '/sounds/double.mp3',
  shadow: '/sounds/shadow.mp3',
  reveal: '/sounds/reveal.mp3',
  capture: '/sounds/capture.mp3',
};

const cache: Partial<Record<SfxKey, HTMLAudioElement>> = {};
let muted = false;

export const setSfxMuted = (m: boolean) => {
  muted = m;
};

export const isSfxMuted = () => muted;

export const playSfx = (key: SfxKey, volume = 0.35) => {
  if (muted) return;
  try {
    if (!cache[key]) {
      const audio = new Audio(SFX_FILES[key]);
      audio.volume = volume;
      cache[key] = audio;
    }
    const audio = cache[key]!;
    audio.currentTime = 0;
    audio.play().catch(() => {
      /* autoplay blocked or file missing — silent */
    });
  } catch {
    /* ignore */
  }
};
