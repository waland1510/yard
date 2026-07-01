// Companion-device pairing primitives (shared between backend authority and frontend).
//
// A player can drive two SURFACES at once: a `map-primary` (desktop, strategic map) and a
// `fpv-companion` (phone, immersive street view), both bound to the SAME game role. The
// host issues a short, single-use, expiring pairing code; the companion redeems it; the
// server links the two sockets.
//
// `PairingRegistry` is the pure, framework-free authority for the code lifecycle (issue /
// redeem / expiry / single-use). The server owns an instance; the clock is injected per
// call so the logic is deterministic and unit-testable.

/** Which surface a paired device drives. */
export type CompanionSurface = 'map-primary' | 'fpv-companion';

/** Hardware class a connected client reports. */
export type CompanionDevice = 'desktop' | 'phone';

export interface PairingRecord {
  code: string;
  channel: string;
  role: string;
  /** Stable client id of the host (map-primary) that issued the code. */
  hostClientId: string;
  createdAt: number;
  expiresAt: number;
  redeemed: boolean;
}

export interface IssueResult {
  code: string;
  expiresAt: number;
}

export type RedeemFailure = 'unknown-code' | 'expired' | 'already-redeemed';

export type RedeemResult =
  | { ok: true; channel: string; role: string; hostClientId: string }
  | { ok: false; reason: RedeemFailure };

export interface PairingRegistryOptions {
  /** Code lifetime in ms (default 5 minutes). */
  ttlMs?: number;
  /** Code generator — injectable for deterministic tests. */
  genCode?: () => string;
}

const DEFAULT_TTL_MS = 5 * 60_000;
// Unambiguous alphabet (no 0/O, 1/I) so a code is easy to read off a screen.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function defaultGenCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Authoritative registry of outstanding pairing codes. Single-use and time-bounded:
 * a code redeems exactly once and only before it expires.
 */
export class PairingRegistry {
  private readonly ttlMs: number;
  private readonly genCode: () => string;
  private readonly records = new Map<string, PairingRecord>();

  constructor(opts: PairingRegistryOptions = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.genCode = opts.genCode ?? defaultGenCode;
  }

  /** Issue a fresh pairing code for a host's (channel, role). */
  issue(input: { channel: string; role: string; hostClientId: string; now: number }): IssueResult {
    this.prune(input.now);
    // Avoid the (astronomically unlikely) collision with a live code.
    let code = this.genCode();
    while (this.records.has(code)) code = this.genCode();
    const expiresAt = input.now + this.ttlMs;
    this.records.set(code, {
      code,
      channel: input.channel,
      role: input.role,
      hostClientId: input.hostClientId,
      createdAt: input.now,
      expiresAt,
      redeemed: false,
    });
    return { code, expiresAt };
  }

  /** Redeem a code. Succeeds at most once, and only before expiry. */
  redeem(input: { code: string; now: number }): RedeemResult {
    const rec = this.records.get(input.code.toUpperCase());
    if (!rec) return { ok: false, reason: 'unknown-code' };
    if (input.now >= rec.expiresAt) {
      this.records.delete(rec.code);
      return { ok: false, reason: 'expired' };
    }
    if (rec.redeemed) return { ok: false, reason: 'already-redeemed' };
    rec.redeemed = true;
    return { ok: true, channel: rec.channel, role: rec.role, hostClientId: rec.hostClientId };
  }

  /** Drop a code (e.g. when the host disconnects before pairing). */
  revoke(code: string): void {
    this.records.delete(code.toUpperCase());
  }

  /** Remove expired records. Called automatically on issue. */
  prune(now: number): void {
    for (const [code, rec] of this.records) {
      if (now >= rec.expiresAt) this.records.delete(code);
    }
  }

  /** Test/debug helper: number of live (unpruned) records. */
  size(): number {
    return this.records.size;
  }
}

/** The opposite surface — a pair always has exactly one of each. */
export function peerSurface(surface: CompanionSurface): CompanionSurface {
  return surface === 'map-primary' ? 'fpv-companion' : 'map-primary';
}
