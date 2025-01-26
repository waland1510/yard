import { Spinner } from '@chakra-ui/react';
import { useEffect } from 'react';
import { useGameStore } from '../../stores/use-game-store';

interface CreateGameProps {
  setCurrentStep: (step: string) => void;
}

export const CreateGame = ({ setCurrentStep }: CreateGameProps) => {
  const channel = useGameStore((state) => state.channel);

  useEffect(() => {
    if (channel) {
      setCurrentStep('addUsername');
    }
  }, [channel, setCurrentStep]);
  return (
    <div>
      Please wait while we create your game. If this takes too long, please
      refresh the page in 30-60 seconds.
      <Spinner />
    </div>
  );
};
