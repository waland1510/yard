// Centralized SFX dispatcher. Uses Web Audio API to generate procedural tones — no asset
// files needed. Respects the mute flag from runner-store. Calls are no-ops if audio isn't
// available (server-side render, locked-down browser, etc).

export type SfxName =
  | 'ticket-spent'
  | 'low-ticket-warning'
  | 'capture'
  | 'reveal'
  | 'ride-start'
  | 'invalid-move'
  | 'map-open'
  | 'map-close'
  | 'secret-armed'
  | 'double-armed'
  | 'turn-banner';

interface SfxConfig {
  /** Type of oscillator. */
  type: OscillatorType;
  /** Frequency in Hz (or starting frequency for sweeps). */
  freq: number;
  /** End frequency for sweeps (optional — defaults to freq). */
  freqEnd?: number;
  /** Duration in seconds. */
  duration: number;
  /** Gain envelope: [attack, decay] in seconds; total = attack + sustain + decay = duration. */
  attack: number;
  decay: number;
  /** Peak amplitude (0..1). */
  amp: number;
  /** Optional secondary tone played in parallel for richness. */
  harmonic?: { freq: number; amp: number };
}

const SFX: Record<SfxName, SfxConfig> = {
  'ticket-spent': {
    type: 'triangle',
    freq: 880,
    duration: 0.12,
    attack: 0.005,
    decay: 0.1,
    amp: 0.18,
  },
  'low-ticket-warning': {
    type: 'square',
    freq: 660,
    duration: 0.18,
    attack: 0.005,
    decay: 0.15,
    amp: 0.18,
    harmonic: { freq: 990, amp: 0.06 },
  },
  capture: {
    type: 'sawtooth',
    freq: 220,
    freqEnd: 65,
    duration: 0.9,
    attack: 0.01,
    decay: 0.85,
    amp: 0.3,
    harmonic: { freq: 110, amp: 0.18 },
  },
  reveal: {
    type: 'sine',
    freq: 440,
    freqEnd: 1320,
    duration: 0.55,
    attack: 0.02,
    decay: 0.5,
    amp: 0.25,
    harmonic: { freq: 880, amp: 0.12 },
  },
  'ride-start': {
    type: 'sine',
    freq: 110,
    freqEnd: 220,
    duration: 0.35,
    attack: 0.02,
    decay: 0.3,
    amp: 0.18,
  },
  'invalid-move': {
    type: 'sawtooth',
    freq: 180,
    freqEnd: 130,
    duration: 0.18,
    attack: 0.005,
    decay: 0.15,
    amp: 0.22,
  },
  'map-open': {
    type: 'sine',
    freq: 660,
    freqEnd: 880,
    duration: 0.14,
    attack: 0.005,
    decay: 0.12,
    amp: 0.12,
  },
  'map-close': {
    type: 'sine',
    freq: 880,
    freqEnd: 660,
    duration: 0.14,
    attack: 0.005,
    decay: 0.12,
    amp: 0.12,
  },
  'secret-armed': {
    type: 'sine',
    freq: 520,
    freqEnd: 780,
    duration: 0.22,
    attack: 0.005,
    decay: 0.2,
    amp: 0.16,
  },
  'double-armed': {
    type: 'sine',
    freq: 360,
    freqEnd: 540,
    duration: 0.22,
    attack: 0.005,
    decay: 0.2,
    amp: 0.16,
  },
  'turn-banner': {
    type: 'triangle',
    freq: 660,
    freqEnd: 880,
    duration: 0.2,
    attack: 0.01,
    decay: 0.18,
    amp: 0.15,
  },
};

let ctx: AudioContext | null = null;
let muted = false;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    // Some browsers require a user gesture before allowing audio
    void ctx.resume().catch(() => {
      /* ignore */
    });
  }
  return ctx;
}

export function setMuted(v: boolean) {
  muted = v;
}

export function isMuted(): boolean {
  return muted;
}

export function play(name: SfxName) {
  if (muted) return;
  const context = getContext();
  if (!context) return;
  const cfg = SFX[name];
  const now = context.currentTime;

  const make = (freq: number, freqEnd: number | undefined, amp: number) => {
    const osc = context.createOscillator();
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd != null && freqEnd !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + cfg.duration);
    }
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(amp, now + cfg.attack);
    gain.gain.linearRampToValueAtTime(0, now + cfg.attack + cfg.decay);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + cfg.duration + 0.05);
  };

  make(cfg.freq, cfg.freqEnd, cfg.amp);
  if (cfg.harmonic) {
    make(cfg.harmonic.freq, cfg.freqEnd && (cfg.freqEnd * (cfg.harmonic.freq / cfg.freq)), cfg.harmonic.amp);
  }
}
