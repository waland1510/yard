// Frontend companion-pairing session (#1). Wraps the WebSocket transport and tracks the
// local device's pairing state: its surface (map-primary / fpv-companion), its peer, and
// the lifecycle events the UI needs (peerAttached / peerLost).
//
// The transport is injected (just a `send`) and inbound pairing messages are fed in via
// `handleMessage`, so the session is fully unit-testable with a mock transport — no real
// socket required. The authoritative code lifecycle lives server-side in PairingRegistry.

import type { CompanionDevice, CompanionSurface } from '@yard/shared-utils';

export interface CompanionTransport {
  /** Send a pairing message over the channel. */
  send(type: 'pairRequest' | 'pairRedeem' | 'pairUnlink', data: Record<string, unknown>): void;
}

export interface PairedPeer {
  clientId: string;
  surface: CompanionSurface;
}

export interface IssuedCode {
  code: string;
  expiresAt: number;
}

type CompanionEvent = 'peerAttached' | 'peerLost' | 'change';

export interface CompanionSessionOptions {
  transport: CompanionTransport;
  deviceType: CompanionDevice;
  /** Stable id for this client. Injectable for deterministic tests. */
  clientId?: string;
}

function genClientId(): string {
  // Random, collision-resistant enough for a session id; not security-sensitive.
  return 'c_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export class CompanionSession {
  readonly clientId: string;
  readonly deviceType: CompanionDevice;
  private readonly transport: CompanionTransport;
  private _surface: CompanionSurface | null = null;
  private _peer: PairedPeer | null = null;
  private readonly listeners: Record<CompanionEvent, Set<() => void>> = {
    peerAttached: new Set(),
    peerLost: new Set(),
    change: new Set(),
  };
  private issueResolve: ((r: IssuedCode) => void) | null = null;

  constructor(opts: CompanionSessionOptions) {
    this.transport = opts.transport;
    this.deviceType = opts.deviceType;
    this.clientId = opts.clientId ?? genClientId();
  }

  /** This device's assigned surface, or null until paired/assigned. */
  surface(): CompanionSurface | null {
    return this._surface;
  }

  /** The paired peer, or null while unpaired. */
  peer(): PairedPeer | null {
    return this._peer;
  }

  isPaired(): boolean {
    return this._peer != null;
  }

  on(ev: CompanionEvent, cb: () => void): () => void {
    this.listeners[ev].add(cb);
    return () => this.listeners[ev].delete(cb);
  }

  private emit(ev: CompanionEvent): void {
    for (const cb of this.listeners[ev]) cb();
    // Any specific event is also a generic "change" for simple subscribers.
    if (ev !== 'change') {
      for (const cb of this.listeners.change) cb();
    }
  }

  /**
   * Ask the server for a pairing code (this device becomes the map-primary host).
   * Resolves once the server replies with `pairCode`.
   */
  issuePairingCode(): Promise<IssuedCode> {
    this.transport.send('pairRequest', {
      clientId: this.clientId,
      deviceType: this.deviceType,
    });
    return new Promise<IssuedCode>((resolve) => {
      this.issueResolve = resolve;
    });
  }

  /** Redeem a code shown on another device — attach as its fpv-companion. */
  attachAsCompanion(code: string): void {
    this.transport.send('pairRedeem', {
      code: code.trim().toUpperCase(),
      clientId: this.clientId,
      deviceType: this.deviceType,
    });
  }

  /** Explicitly end the companion session (#12): tell the server to unlink, then clear
   *  local state. The peer is notified via the server's `paired`-without-peer broadcast. */
  unpair(): void {
    this.transport.send('pairUnlink', { clientId: this.clientId });
    this.reset();
  }

  /**
   * Feed an inbound pairing message (called by the WS dispatch). Recognized types:
   * `pairCode` (host got its code), `paired` (link established or peer changed),
   * `pairError` (redeem/issue failed).
   */
  handleMessage(
    type: string,
    data: {
      code?: string;
      expiresAt?: number;
      surface?: CompanionSurface;
      peerClientId?: string;
      peerSurface?: CompanionSurface;
    }
  ): void {
    switch (type) {
      case 'pairCode':
        this._surface = 'map-primary';
        if (this.issueResolve && data.code) {
          this.issueResolve({ code: data.code, expiresAt: data.expiresAt ?? 0 });
          this.issueResolve = null;
        }
        this.emit('change');
        break;
      case 'paired':
        if (data.surface) this._surface = data.surface;
        if (data.peerClientId && data.peerSurface) {
          this._peer = { clientId: data.peerClientId, surface: data.peerSurface };
          this.emit('peerAttached');
        } else {
          // The server signals peer loss with a `paired` carrying no peer.
          this._peer = null;
          this.emit('peerLost');
        }
        break;
      case 'pairError':
        this.emit('change');
        break;
      default:
        break;
    }
  }

  /** Clear all pairing state (e.g. on unpair / leaving the game). */
  reset(): void {
    this._surface = null;
    this._peer = null;
    this.issueResolve = null;
    this.emit('change');
  }
}

// Session-wide singleton, set up by game.tsx once the WebSocket client exists, read by the
// pairing UI. Null until a real (non-mock) session connects.
let singleton: CompanionSession | null = null;
export function setCompanionSession(s: CompanionSession | null): void {
  singleton = s;
}
export function getCompanionSession(): CompanionSession | null {
  return singleton;
}
