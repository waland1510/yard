import { Spinner } from '@chakra-ui/react';
import { useState } from 'react';
import { createGame } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import useWebSocket from '../use-websocket';
import { useTranslation } from 'react-i18next';

interface StartProps {
  existingChannel: string | null;
  handleContinueGame: () => void;
  setCurrentStep: (step: string) => void;
}

export const Start = ({
  existingChannel,
  handleContinueGame,
  setCurrentStep,
}: StartProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { sendMessage } = useWebSocket('');
  const { t } = useTranslation();
  const handleNewGame = async () => {
    try {
      setIsLoading(true);
      const { createdGame } = await createGame();
      useGameStore.setState(createdGame);
      if (createdGame) {
        sendMessage('startGame', { ch: createdGame.channel });
        setCurrentStep('addUsername');
      }
    } catch (error) {
      console.error('Failed to create game:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center">
        <div>
         {t('waitForServer')}
        </div>
        <Spinner />
      </div>
    );
  }
  return (
    <div className="text-center">
      <p className="text-lg text-gray-700">
        {existingChannel && t('welcome')}
      </p>
      {existingChannel && (
        <button
          className="px-6 py-2 bg-yellow-600 text-black rounded-lg shadow-md hover:bg-red-700 transition duration-300"
          onClick={handleContinueGame}
        >
         {t('continueGame')}
        </button>
      )}
      <button
        className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300"
        onClick={() => {
          handleNewGame();
        }}
      >
        {t('start')}
      </button>
    </div>
  );
};
