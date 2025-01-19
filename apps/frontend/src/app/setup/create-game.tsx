import React, { useEffect } from 'react';
import { useGameStore } from '../../stores/use-game-store';
import useWebSocket from '../use-websocket';

interface CreateGameProps {
  setCurrentStep: (step: string) => void;
}

export const CreateGame = ({setCurrentStep}: CreateGameProps) => {
  const channel = useGameStore((state) => state.channel);
  console.log({channel});

  const { sendMessage } = useWebSocket(channel);
  sendMessage('startGame', { ch: channel });
  useEffect(() => {
    if (channel) {
      setCurrentStep('addUsername');
    }
  }, [channel]);
  return (
    <div>
      Game Started
    </div>
  );
};
