import { useEffect, useRef } from 'react';
import { RunnerState, useRunnerStore } from '../stores/use-runner-store';

export const usePlayerSubscription = () => {
  const state = useRunnerStore((state) => state);

  const playersRef = useRef<RunnerState>(state);

  useEffect(() => {
    const unsubscribe = useRunnerStore.subscribe((state) => {
      playersRef.current = state;
    });

    return () => {
      unsubscribe();
    };
  }, [playersRef]);

  return playersRef.current;
};
