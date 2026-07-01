// Local-player view state. Not authoritative game state — just what the LOCAL viewer is
// looking at and doing right now: their seat, their pending move draft, HUD toggles,
// magnify, language, debug-flag.
//
// Persisted slice (settings) is stored in localStorage; transient slice (pending move)
// is in-memory only.

import { create } from 'zustand';
import type { MoveType, RoleType } from '@yard/shared-utils';
import {
  resolveSurface,
  type DeviceType,
  type GraphicsQuality,
  type Surface,
  type SurfaceRole,
  type ViewMode,
} from '../core/device-surface';

const STORAGE_KEY = 'yard-fpv-runner-prefs';

interface PersistedPrefs {
  language: string;
  muted: boolean;
  debugEnabled: boolean;
  lastUsername: string;
  viewMode: ViewMode;
  graphicsQuality: GraphicsQuality;
}

const DEFAULT_PREFS: PersistedPrefs = {
  language: 'en',
  muted: false,
  debugEnabled: false,
  lastUsername: '',
  viewMode: 'auto',
  graphicsQuality: 'auto',
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

  /** Detected hardware class — drives the default surface (phone → FPV, desktop → map). */
  deviceType: DeviceType;
  /** Local viewer's surface preference. `auto` resolves from device class; `fpv`/`map`
   *  are explicit overrides chosen via the surface toggle. Persisted. */
  viewMode: ViewMode;
  /** Surface role assigned by companion pairing (#1): `controller` (fpv) on the phone,
   *  `viewer` (map) on the desktop. Null while unpaired. Outranks device-class default. */
  pairingRole: SurfaceRole | null;
  /** FPV graphics fidelity preference (#3). `auto` resolves from device class. Persisted. */
  graphicsQuality: GraphicsQuality;
  /** Companion peer connected (heartbeat alive); false when unpaired or dropped (#12). */
  peerConnected: boolean;
  /** The move the paired peer is lining up, relayed for preview on this surface (#6). */
  peerPendingMove: PendingMove | null;

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
  setDeviceType(t: DeviceType): void;
  setViewMode(m: ViewMode): void;
  setPairingRole(r: SurfaceRole | null): void;
  setPeerConnected(v: boolean): void;
  setPeerPendingMove(m: PendingMove | null): void;
  setGraphicsQuality(q: GraphicsQuality): void;
  /** Flip the active surface, persisting it as an explicit override. */
  toggleSurface(): void;
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
  deviceType: 'desktop',
  viewMode: persisted.viewMode,
  pairingRole: null,
  graphicsQuality: persisted.graphicsQuality,
  peerConnected: false,
  peerPendingMove: null,
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
      viewMode: get().viewMode,
      graphicsQuality: get().graphicsQuality,
    };
    set({ lastUsername: name });
    savePrefs(prefs);
  },

  setDeviceType(t) {
    set({ deviceType: t });
  },

  setViewMode(m) {
    set({ viewMode: m });
    savePrefs({ ...currentPrefs(get), viewMode: m });
  },

  setPairingRole(r) {
    set({ pairingRole: r });
  },

  setPeerConnected(v) {
    set({ peerConnected: v });
  },

  setPeerPendingMove(m) {
    set({ peerPendingMove: m });
  },

  setGraphicsQuality(q) {
    set({ graphicsQuality: q });
    savePrefs({ ...currentPrefs(get), graphicsQuality: q });
  },

  toggleSurface() {
    const s = get();
    const current = resolveSurface({
      deviceType: s.deviceType,
      viewMode: s.viewMode,
      pairing: s.pairingRole != null ? { surfaceRole: s.pairingRole } : null,
    });
    const next: Surface = current === 'map' ? 'fpv' : 'map';
    set({ viewMode: next });
    savePrefs({ ...currentPrefs(get), viewMode: next });
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
      pairingRole: null,
      peerConnected: false,
      peerPendingMove: null,
    });
  },
}));

/** The surface the local viewer should currently see. Pairing is not yet wired (#1),
 *  so resolution is device-class + manual-override only for now. */
export function selectActiveSurface(s: RunnerStore): Surface {
  return resolveSurface({
    deviceType: s.deviceType,
    viewMode: s.viewMode,
    pairing: s.pairingRole != null ? { surfaceRole: s.pairingRole } : null,
  });
}

function currentPrefs(get: () => RunnerStore): PersistedPrefs {
  const s = get();
  return {
    language: s.language,
    muted: s.muted,
    debugEnabled: s.debugEnabled,
    lastUsername: s.lastUsername,
    viewMode: s.viewMode,
    graphicsQuality: s.graphicsQuality,
  };
}
