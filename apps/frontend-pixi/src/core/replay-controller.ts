// Owns the replay state machine. Filters live updates while replay is active so the
// board does not jump under the user's scrubber.
//
// Pure-ish: no React, no DOM. Uses simple listener pub/sub for subscribers (game store,
// HUD, world). The controller computes per-turn deduction snapshots eagerly when a
// snapshot is recorded so scrubbing is instant.

import type { Move, Player } from '@yard/shared-utils';
import { runDeduction, type DeductionResult } from './deduction-engine';

export interface ReplaySnapshot {
  /** Snapshot index — typically equals the number of culprit moves up to and including this turn. */
  turnIndex: number;
  /** Moves recorded up to (and including) this turn. */
  moves: Move[];
  /** Player positions at this turn (each player's `position` as of this turn's end). */
  players: Player[];
  /** Mr. X's actual node at this turn — only known post-game (filled by server) or in dev mode. */
  culpritActualPosition: number | null;
  /** Deduction result at this turn. Null if the engine could not compute. */
  deduction: DeductionResult | null;
}

export interface ReplayController {
  isActive(): boolean;
  currentTurn(): number;
  totalTurns(): number;
  current(): ReplaySnapshot | null;
  enter(): void;
  exit(): void;
  next(): void;
  prev(): void;
  seek(turn: number): void;
  /** Append a snapshot. Called during live play and on game-end load. */
  record(snapshot: Omit<ReplaySnapshot, 'deduction'>): void;
  subscribe(listener: () => void): () => void;
  reset(): void;
}

export function createReplayController(): ReplayController {
  let active = false;
  let turn = 0;
  let snapshots: ReplaySnapshot[] = [];
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const l of listeners) l();
  };

  return {
    isActive: () => active,
    currentTurn: () => turn,
    totalTurns: () => snapshots.length,
    current: () => snapshots[turn] ?? null,

    enter: () => {
      if (active) return;
      active = true;
      turn = Math.max(0, snapshots.length - 1);
      notify();
    },

    exit: () => {
      if (!active) return;
      active = false;
      notify();
    },

    next: () => {
      if (turn >= snapshots.length - 1) return;
      turn++;
      notify();
    },

    prev: () => {
      if (turn <= 0) return;
      turn--;
      notify();
    },

    seek: (t: number) => {
      const clamped = Math.max(0, Math.min(snapshots.length - 1, t));
      if (clamped === turn) return;
      turn = clamped;
      notify();
    },

    record: (snap) => {
      const withDeduction: ReplaySnapshot = {
        ...snap,
        deduction: runDeduction(snap.moves, snap.players),
      };
      snapshots = [...snapshots, withDeduction];
      if (!active) turn = snapshots.length - 1;
      notify();
    },

    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },

    reset: () => {
      snapshots = [];
      turn = 0;
      active = false;
      notify();
    },
  };
}
