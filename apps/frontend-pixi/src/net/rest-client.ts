// Thin REST adapter for the backend's HTTP endpoints. Wraps fetch with a base URL, JSON
// framing, and graceful error handling. Returns null on network errors so callers can
// fall back to mock mode without needing try/catch every call.
//
// Backend exposes:
//   POST /api/games        — create a new game; returns { channel, ... }
//   GET  /api/games/:id    — fetch full GameState by channel
//   GET  /api/geo          — IP-based geolocation (best-effort)

import type { GameState } from '@yard/shared-utils';
import type { ThemeName } from '../core/theme-registry';

const DEFAULT_BASE = 'http://localhost:3000';

function baseUrl(): string {
  const env = (import.meta as { env?: { VITE_API_URL?: string } }).env;
  return env?.VITE_API_URL ?? DEFAULT_BASE;
}

export interface CreateGameRequest {
  theme: ThemeName;
  withAI?: boolean;
}

export interface CreateGameResponse {
  channel: string;
  /** Players the backend created — needed so callers can flip non-human roles to
   *  isAI=true via updatePlayer. */
  players?: GameState['players'];
}

export interface GeoInfo {
  city?: string;
  region?: string;
  country?: string;
}

export async function createGame(req: CreateGameRequest): Promise<CreateGameResponse | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      channel?: string;
      createdGame?: GameState;
    } & Partial<GameState>;
    // Backend wraps the game state under `createdGame`; older shapes put `channel` at top.
    const channel = body.createdGame?.channel ?? body.channel;
    if (typeof channel === 'string' && channel.length > 0) {
      return { channel, players: body.createdGame?.players ?? body.players };
    }
    return null;
  } catch {
    return null;
  }
}

/** PATCH a player's fields — used to flip detectives to AI control after game
 *  creation so the backend's handleAIMove fires for them. The legacy frontend
 *  hits this endpoint per detective in the "choose role" step. */
export async function updatePlayer(
  playerId: number,
  fields: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/api/players/${playerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getGame(channel: string): Promise<GameState | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/games/${encodeURIComponent(channel)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<GameState> & { createdGame?: GameState };
    // Same wrapper pattern as createGame — accept either shape
    if (body.createdGame) return body.createdGame;
    if (body.channel) return body as GameState;
    return null;
  } catch {
    return null;
  }
}

export interface PresenceInfo {
  members: Array<{ role: string; username: string }>;
}

export async function getPresence(channel: string): Promise<PresenceInfo | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/presence/${encodeURIComponent(channel)}`);
    if (!res.ok) return null;
    return (await res.json()) as PresenceInfo;
  } catch {
    return null;
  }
}

export async function getGeo(): Promise<GeoInfo | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/geo`);
    if (!res.ok) return null;
    return (await res.json()) as GeoInfo;
  } catch {
    return null;
  }
}

/** Generate a local mock channel ID — used when REST fails so the lobby still leads
 *  somewhere usable (mock mode). */
export function makeMockChannel(): string {
  const id = Math.random().toString(36).slice(2, 9);
  return `mock-${id}`;
}
