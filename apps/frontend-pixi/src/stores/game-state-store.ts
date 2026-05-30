// Authoritative session state for the live game. Zustand-based.
// Single source of truth for what the server says is happening. Pure reducer-style mutations;
// no I/O, no Three.js, no React (the store is hookable from React but not React-specific).

import { create } from 'zustand';
import type { Player, RoleType, Move, MoveType, Status, GameState } from '@yard/shared-utils';
import type { ConnectionStatus } from '../net/websocket-client';
import type { ThemeName } from '../core/theme-registry';

export interface GameSession {
  /** Server channel for this game (URL slug). */
  channel: string;
  /** Active theme — locked at game create, used by HUD + 3D dressing. */
  theme: ThemeName;
  /** Live player roster. Server-broadcast. */
  players: Player[];
  /** Public move log (Mr. X moves may have stripped position between reveals — see PRD trust-the-client note). */
  moves: Move[];
  /** Whose turn it is right now. */
  currentTurn: RoleType;
  /** Active vs finished. */
  status: Status;
  /** Server tells us when Mr. X is mid-double. */
  isDoubleMove: boolean;
  /** Current websocket connection status. */
  connection: ConnectionStatus;
  /** Roles currently held by a connected client in this channel (presence broadcast
   *  from the backend). Used by the JoinOverlay to disable already-taken seats. */
  occupiedRoles: ReadonlySet<string>;
}

export interface GameStateStore extends GameSession {
  /** Apply a full server-broadcast snapshot. Idempotent. */
  applyServerState(snapshot: Partial<GameState>): void;
  /** Append a move (server-confirmed or optimistic). */
  appendMove(move: Move): void;
  /** Update a player's position (used after a move). */
  setPosition(role: RoleType, position: number): void;
  /** Decrement tickets after a move. */
  decrementTickets(role: RoleType, type: MoveType, secret?: boolean, double?: boolean): void;
  /** Set whose turn it is (server tells us this on each broadcast). */
  setCurrentTurn(role: RoleType): void;
  /** Toggle mid-double-move flag. */
  setIsDoubleMove(v: boolean): void;
  /** Move to finished + record winner reason. */
  setFinished(): void;
  /** Set the channel (called on first connect). */
  setChannel(channel: string): void;
  /** Set the theme (locked at game create). */
  setTheme(theme: ThemeName): void;
  /** Reflect connection status from the websocket layer. */
  setConnection(s: ConnectionStatus): void;
  /** Update occupied-role presence from the backend. */
  setOccupiedRoles(roles: ReadonlySet<string>): void;
  /** Wipe everything — call on disconnect/exit. */
  reset(): void;
}

const INITIAL: GameSession = {
  channel: '',
  theme: 'classic',
  players: [],
  moves: [],
  currentTurn: 'culprit',
  status: 'active',
  isDoubleMove: false,
  connection: 'idle',
  occupiedRoles: new Set<string>(),
};

export const useGameStateStore = create<GameStateStore>((set) => ({
  ...INITIAL,

  applyServerState(snapshot) {
    set((s) => ({
      players: snapshot.players ?? s.players,
      moves: snapshot.moves ?? s.moves,
      currentTurn: snapshot.currentTurn ?? s.currentTurn,
      status: snapshot.status ?? s.status,
      isDoubleMove: snapshot.isDoubleMove ?? s.isDoubleMove,
      theme: (snapshot.theme as ThemeName | undefined) ?? s.theme,
      channel: snapshot.channel ?? s.channel,
    }));
  },

  appendMove(move) {
    set((s) => ({ moves: [...s.moves, move] }));
  },

  setPosition(role, position) {
    set((s) => ({
      players: s.players.map((p) =>
        p.role === role ? { ...p, previousPosition: p.position, position } : p
      ),
    }));
  },

  decrementTickets(role, type, secret, double) {
    set((s) => ({
      players: s.players.map((p) => {
        if (p.role !== role) return p;
        const next = { ...p };
        if (secret) {
          next.secretTickets = Math.max(0, (p.secretTickets ?? 0) - 1);
        } else if (type === 'taxi') {
          next.taxiTickets = Math.max(0, p.taxiTickets - 1);
        } else if (type === 'bus') {
          next.busTickets = Math.max(0, p.busTickets - 1);
        } else if (type === 'underground') {
          next.undergroundTickets = Math.max(0, p.undergroundTickets - 1);
        }
        if (double) {
          next.doubleTickets = Math.max(0, (p.doubleTickets ?? 0) - 1);
        }
        return next;
      }),
    }));
  },

  setCurrentTurn(role) {
    set({ currentTurn: role });
  },

  setIsDoubleMove(v) {
    set({ isDoubleMove: v });
  },

  setFinished() {
    set({ status: 'finished' });
  },

  setChannel(channel) {
    set({ channel });
  },

  setTheme(theme) {
    set({ theme });
  },

  setConnection(s) {
    set({ connection: s });
  },

  setOccupiedRoles(roles) {
    set({ occupiedRoles: roles });
  },

  reset() {
    set({ ...INITIAL });
  },
}));
