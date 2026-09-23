// Speaking detection for call tiles. One AnalyserNode per stream, polled on a timer; only
// changes in who is speaking are reported.

const POLL_MS = 150;
const SPEAKING_RMS = 0.04;
const HOLD_MS = 450;

interface Meter {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buffer: Float32Array<ArrayBuffer>;
  lastLoud: number;
}

export class VoiceActivity {
  private context: AudioContext | null = null;
  private readonly meters = new Map<string, Meter>();
  private speaking: Record<string, boolean> = {};
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly onChange: (speaking: Record<string, boolean>) => void) {}

  track(id: string, stream: MediaStream | null): void {
    const existing = this.meters.get(id);
    if (existing?.stream === stream) return;
    if (existing) this.untrack(id);
    if (!stream || stream.getAudioTracks().length === 0) return;

    this.context ??= new AudioContext();
    void this.context.resume();
    const source = this.context.createMediaStreamSource(stream);
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    this.meters.set(id, {
      stream,
      source,
      analyser,
      buffer: new Float32Array(analyser.fftSize),
      lastLoud: 0,
    });
    this.timer ??= setInterval(() => this.poll(), POLL_MS);
  }

  retain(ids: Set<string>): void {
    for (const id of [...this.meters.keys()]) {
      if (!ids.has(id)) this.untrack(id);
    }
  }

  dispose(): void {
    for (const id of [...this.meters.keys()]) this.untrack(id);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.context?.close();
    this.context = null;
  }

  private untrack(id: string): void {
    const meter = this.meters.get(id);
    if (!meter) return;
    meter.source.disconnect();
    this.meters.delete(id);
    if (this.speaking[id]) {
      const rest = { ...this.speaking };
      delete rest[id];
      this.speaking = rest;
      this.onChange(rest);
    }
  }

  private poll(): void {
    const now = Date.now();
    let changed = false;
    const next: Record<string, boolean> = {};
    for (const [id, meter] of this.meters) {
      meter.analyser.getFloatTimeDomainData(meter.buffer);
      let sum = 0;
      for (const v of meter.buffer) sum += v * v;
      if (Math.sqrt(sum / meter.buffer.length) > SPEAKING_RMS) meter.lastLoud = now;
      next[id] = now - meter.lastLoud < HOLD_MS;
      if (next[id] !== !!this.speaking[id]) changed = true;
    }
    if (!changed) return;
    this.speaking = next;
    this.onChange(next);
  }
}
