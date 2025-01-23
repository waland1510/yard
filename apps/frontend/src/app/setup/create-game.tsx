import React, { useEffect } from 'react';
import { useGameStore } from '../../stores/use-game-store';
import useWebSocket from '../use-websocket';
import { Spinner } from '@chakra-ui/react';

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
      Please wait while we create your game...
      <Spinner />
    </div>
  );
};
