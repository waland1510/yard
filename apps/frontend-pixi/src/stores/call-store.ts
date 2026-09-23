// Group-call view state, mirrored from the CallMesh. Layouts (side strip today, floating
// window or dock faces later) read only this store; the mesh owns connections and media.

import { create } from 'zustand';
import type { CallMesh, CallPeer, CallSnapshot } from '../net/call-mesh';
import { VoiceActivity } from '../net/voice-activity';

export const LOCAL_TILE_ID = 'local';

interface CallStoreState extends CallSnapshot {
  available: boolean;
  collapsed: boolean;
  speaking: Record<string, boolean>;
  join(): Promise<void>;
  leave(): void;
  toggleMic(): Promise<void>;
  toggleCam(): Promise<void>;
  setCollapsed(collapsed: boolean): void;
}

const IDLE: CallSnapshot = {
  joined: false,
  joining: false,
  mic: false,
  cam: false,
  localStream: null,
  peers: [],
  othersInCall: 0,
  error: null,
};

let mesh: CallMesh | null = null;

export const useCallStore = create<CallStoreState>((set, get) => ({
  ...IDLE,
  available: false,
  collapsed: false,
  speaking: {},
  join: async () => {
    await mesh?.join();
  },
  leave: () => {
    mesh?.leave();
  },
  toggleMic: async () => {
    await mesh?.setMic(!get().mic);
  },
  toggleCam: async () => {
    await mesh?.setCam(!get().cam);
  },
  setCollapsed: (collapsed) => set({ collapsed }),
}));

/** Binds the store to a live mesh for the session; the returned fn unbinds and disposes. */
export function connectCallMesh(next: CallMesh): () => void {
  mesh = next;
  const voice = new VoiceActivity((speaking) => useCallStore.setState({ speaking }));
  const unsubscribe = next.subscribe((snapshot) => {
    voice.track(LOCAL_TILE_ID, snapshot.localStream);
    for (const peer of snapshot.peers) voice.track(peer.clientId, peer.stream);
    voice.retain(new Set([LOCAL_TILE_ID, ...snapshot.peers.map((p) => p.clientId)]));
    useCallStore.setState(snapshot);
  });
  useCallStore.setState({ ...next.snapshot(), available: true });
  return () => {
    unsubscribe();
    next.dispose();
    voice.dispose();
    if (mesh === next) mesh = null;
    useCallStore.setState({ ...IDLE, available: false, speaking: {} });
  };
}

export const selectCallAvailable = (s: CallStoreState): boolean => s.available;
export const selectCallJoined = (s: CallStoreState): boolean => s.joined;
export const selectCallJoining = (s: CallStoreState): boolean => s.joining;
export const selectCallCollapsed = (s: CallStoreState): boolean => s.collapsed;
export const selectCallError = (s: CallStoreState): string | null => s.error;
export const selectOthersInCall = (s: CallStoreState): number => s.othersInCall;
export const selectCallMic = (s: CallStoreState): boolean => s.mic;
export const selectCallCam = (s: CallStoreState): boolean => s.cam;
export const selectLocalStream = (s: CallStoreState): MediaStream | null => s.localStream;
export const selectCallPeers = (s: CallStoreState): CallPeer[] => s.peers;
export const selectSpeaking = (s: CallStoreState): Record<string, boolean> => s.speaking;
