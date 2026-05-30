// Local-player view state. Not authoritative game state — just what the LOCAL viewer is
// looking at and doing right now: their seat, their pending move draft, HUD toggles,
// magnify, language, debug-flag.
//
// Persisted slice (settings) is stored in localStorage; transient slice (pending move)
// is in-memory only.

import { create } from 'zustand';
import type { MoveType, RoleType } from '@yard/shared-utils';

const STORAGE_KEY = 'yard-fpv-runner-prefs';

interface PersistedPrefs {
  language: string;
  muted: boolean;
  debugEnabled: boolean;
  lastUsername: string;
}

const DEFAULT_PREFS: PersistedPrefs = {
  language: 'en',
  muted: false,
  debugEnabled: false,
  lastUsername: '',
};

export interface PendingMove {
  targetNodeId: number;
  transport: MoveType;
  secret: boolean;
  double: boolean;
}

export interface RunnerStore {
  /** The seat the local player has claimed (URL ?role= or setup choice). */
  myRole: RoleType | null;
  /** Username the local player entered. */
  myName: string;
  /** Role the player is currently *viewing as* — equals myRole unless impersonating another detective. */
  viewingAs: RoleType | null;

  /** Pending move (player has selected a vehicle but not confirmed). */
  pendingMove: PendingMove | null;

  /** Mr. X-only: next move is a Secret move (transport hidden in the public log). */
  pendingSecret: boolean;
  /** Mr. X-only: next move starts a double-move (this move + one more, with no opponent
   *  turns in between). Auto-clears after both legs are committed. */
  pendingDouble: boolean;

  /** Paper map open (TAB). */
  mapOpen: boolean;
  /** Magnify lens on the paper map. */
  magnifyEnabled: boolean;
  /** Deduction heatmap toggle. */
  heatmapEnabled: boolean;
  /** Left drawer (players list) open. */
  playersDrawerOpen: boolean;
  /** Right drawer (move log) open. */
  movesDrawerOpen: boolean;

  /** Persisted prefs. */
  language: string;
  muted: boolean;
  debugEnabled: boolean;
  lastUsername: string;

  /** Actions */
  setIdentity(role: RoleType | null, name: string): void;
  setViewingAs(role: RoleType | null): void;
  setPendingMove(m: PendingMove | null): void;
  updatePendingMove(patch: Partial<PendingMove>): void;
  setPendingSecret(v: boolean): void;
  setPendingDouble(v: boolean): void;
  setMapOpen(open: boolean): void;
  setMagnifyEnabled(v: boolean): void;
  setHeatmapEnabled(v: boolean): void;
  setPlayersDrawerOpen(v: boolean): void;
  setMovesDrawerOpen(v: boolean): void;
  setLanguage(lang: string): void;
  setMuted(v: boolean): void;
  setDebugEnabled(v: boolean): void;
  reset(): void;
}

function loadPrefs(): PersistedPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<PersistedPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: PersistedPrefs) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private-mode failures
  }
}

const persisted = loadPrefs();

export const useRunnerStore = create<RunnerStore>((set, get) => ({
  myRole: null,
  myName: persisted.lastUsername,
  viewingAs: null,
  pendingMove: null,
  pendingSecret: false,
  pendingDouble: false,
  mapOpen: false,
  magnifyEnabled: false,
  heatmapEnabled: true,
  playersDrawerOpen: false,
  movesDrawerOpen: false,

  language: persisted.language,
  muted: persisted.muted,
  debugEnabled: persisted.debugEnabled,
  lastUsername: persisted.lastUsername,

  setIdentity(role, name) {
    set({ myRole: role, myName: name, viewingAs: role });
    const prefs: PersistedPrefs = {
      language: get().language,
      muted: get().muted,
      debugEnabled: get().debugEnabled,
      lastUsername: name,
    };
    set({ lastUsername: name });
    savePrefs(prefs);
  },

  setViewingAs(role) {
    set({ viewingAs: role });
  },

  setPendingMove(m) {
    set({ pendingMove: m });
  },

  updatePendingMove(patch) {
    set((s) => (s.pendingMove ? { pendingMove: { ...s.pendingMove, ...patch } } : s));
  },

  setPendingSecret(v) {
    set({ pendingSecret: v });
  },

  setPendingDouble(v) {
    set({ pendingDouble: v });
  },

  setMapOpen(open) {
    set({ mapOpen: open });
  },

  setMagnifyEnabled(v) {
    set({ magnifyEnabled: v });
  },

  setHeatmapEnabled(v) {
    set({ heatmapEnabled: v });
  },

  setPlayersDrawerOpen(v) {
    set({ playersDrawerOpen: v });
  },

  setMovesDrawerOpen(v) {
    set({ movesDrawerOpen: v });
  },

  setLanguage(lang) {
    set({ language: lang });
    savePrefs({ ...currentPrefs(get), language: lang });
  },

  setMuted(v) {
    set({ muted: v });
    savePrefs({ ...currentPrefs(get), muted: v });
  },

  setDebugEnabled(v) {
    set({ debugEnabled: v });
    savePrefs({ ...currentPrefs(get), debugEnabled: v });
  },

  reset() {
    set({
      myRole: null,
      myName: get().lastUsername,
      viewingAs: null,
      pendingMove: null,
      pendingSecret: false,
      pendingDouble: false,
      mapOpen: false,
      magnifyEnabled: false,
      playersDrawerOpen: false,
      movesDrawerOpen: false,
    });
  },
}));

function currentPrefs(get: () => RunnerStore): PersistedPrefs {
  const s = get();
  return {
    language: s.language,
    muted: s.muted,
    debugEnabled: s.debugEnabled,
    lastUsername: s.lastUsername,
  };
}
