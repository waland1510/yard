// Singleton replay controller — one per session. Lets the click handler record snapshots
// without needing to thread the controller through props.

import { useEffect, useState } from 'react';
import { createReplayController } from './replay-controller';

export const replay = createReplayController();

interface ReplayView {
  isActive: boolean;
  currentTurn: number;
  totalTurns: number;
  culpritActualPosition: number | null;
}

function snapshot(): ReplayView {
  const cur = replay.current();
  return {
    isActive: replay.isActive(),
    currentTurn: replay.currentTurn(),
    totalTurns: replay.totalTurns(),
    culpritActualPosition: cur?.culpritActualPosition ?? null,
  };
}

/** React hook subscribing to the singleton — components re-render when replay state changes. */
export function useReplay(): ReplayView {
  const [view, setView] = useState<ReplayView>(snapshot);
  useEffect(() => {
    const unsub = replay.subscribe(() => setView(snapshot()));
    // Sync on mount in case state changed between render and effect setup
    setView(snapshot());
    return unsub;
  }, []);
  return view;
}
