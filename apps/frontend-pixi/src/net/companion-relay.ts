// Companion relay (#6). Relays TRANSIENT view/intent state between paired devices — the
// half-entered move, who you're impersonating, where the camera is looking — so the phone
// FPV and desktop map feel like one game. This is NOT authoritative game state: relayed
// payloads must never be merged into GameStateStore (they're view/intent only).
//
// Transport is injected and inbound messages are fed via `handleMessage`, so the relay is
// fully unit-testable with a mock transport. Relaying is a no-op while unpaired.

import type { MoveType, RoleType } from '@yard/shared-utils';

export type RelayKind = 'pendingMove' | 'viewingAs' | 'cameraHint';

/** The half-entered move a player is lining up (mirrors RunnerStore.PendingMove). */
export interface RelayPendingMove {
  targetNodeId: number;
  transport: MoveType;
  secret: boolean;
  double: boolean;
}

/** Payload type for each relay kind. */
export interface RelayPayloads {
  pendingMove: RelayPendingMove | null;
  viewingAs: RoleType | null;
  cameraHint: { nodeId: number };
}

export interface RelayTransport {
  /** Send a relay envelope over the channel; the server forwards it to the paired peer. */
  send(type: 'companionRelay', data: { kind: RelayKind; payload: unknown }): void;
}

export interface CompanionRelayOptions {
  transport: RelayTransport;
  /** Whether a peer is currently paired — relaying is a no-op otherwise. */
  isPaired: () => boolean;
}

export class CompanionRelay {
  private readonly transport: RelayTransport;
  private readonly isPaired: () => boolean;
  private readonly handlers: Record<RelayKind, Set<(payload: unknown) => void>> = {
    pendingMove: new Set(),
    viewingAs: new Set(),
    cameraHint: new Set(),
  };

  constructor(opts: CompanionRelayOptions) {
    this.transport = opts.transport;
    this.isPaired = opts.isPaired;
  }

  /** Relay a piece of view/intent to the peer. Returns false (no send) when unpaired. */
  send<K extends RelayKind>(kind: K, payload: RelayPayloads[K]): boolean {
    if (!this.isPaired()) return false;
    this.transport.send('companionRelay', { kind, payload });
    return true;
  }

  /** Subscribe to a relay kind. Returns an unsubscribe fn. */
  on<K extends RelayKind>(kind: K, handler: (payload: RelayPayloads[K]) => void): () => void {
    const set = this.handlers[kind];
    const wrapped = handler as (payload: unknown) => void;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  /** Dispatch an inbound relay envelope to the handlers registered for its kind. */
  handleMessage(data: { kind: RelayKind; payload: unknown }): void {
    const set = this.handlers[data.kind];
    if (!set) return;
    for (const h of set) h(data.payload);
  }
}

// Session-wide singleton, mirroring CompanionSession. Null until a real session connects.
let singleton: CompanionRelay | null = null;
export function setCompanionRelay(r: CompanionRelay | null): void {
  singleton = r;
}
export function getCompanionRelay(): CompanionRelay | null {
  return singleton;
}
