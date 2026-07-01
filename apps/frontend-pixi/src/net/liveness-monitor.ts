// Companion liveness (#12). Detects a dropped/sleeping peer via heartbeat. The runtime
// wrapper sends periodic pings and calls `markSeen` on any inbound peer signal (message or
// pong); `isAlive(now)` reports whether the peer has been heard from within the timeout.
//
// Pure and deterministic — the clock is passed in — so the drop-detection logic is unit-
// testable without timers. When `isAlive` flips to false the UI shows a "disconnected"
// badge and move authority falls back to the surviving device (see MoveAuthority, #7).

export interface LivenessOptions {
  /** Peer is considered lost if no signal arrives within this window (default 12s). */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;

export class LivenessMonitor {
  private readonly timeoutMs: number;
  private lastSeen: number | null = null;

  constructor(opts: LivenessOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Record a peer signal observed at `now`. */
  markSeen(now: number): void {
    this.lastSeen = now;
  }

  /** True when the peer has been heard from within the timeout window. */
  isAlive(now: number): boolean {
    if (this.lastSeen == null) return false;
    return now - this.lastSeen < this.timeoutMs;
  }

  /** Milliseconds since the last peer signal, or Infinity if never seen. */
  sinceLastSeen(now: number): number {
    return this.lastSeen == null ? Infinity : now - this.lastSeen;
  }

  /** Forget the peer (on unpair / disconnect). */
  reset(): void {
    this.lastSeen = null;
  }
}
