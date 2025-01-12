import { useEffect, useRef } from 'react';
import { ClientGameState, useGameStore } from '../stores/use-game-store';

export const usePlayersSubscription = () => {
  const state = useGameStore((state) => state);
  const playersRef = useRef<ClientGameState['players']>(state.players);

  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      playersRef.current = state.players;
    });

    return () => {
      unsubscribe();
    };
  }, [playersRef]);

  return playersRef.current;
};
