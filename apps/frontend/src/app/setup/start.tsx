import { Spinner } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGame } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import useWebSocket from '../use-websocket';

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
  const { theme } = useGameStore();

  const handleNewGame = async () => {
    try {
      setIsLoading(true);
      const { createdGame } = await createGame({ theme });
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
      <div className="flex flex-col items-center gap-3 text-white/70">
        <span className="text-sm tracking-widest uppercase">{t('waitForServer')}</span>
        <Spinner color="white" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {existingChannel && (
        <p className="text-white/60 text-sm tracking-wide">{t('welcome')}</p>
      )}
      <div className="flex gap-4 flex-wrap justify-center">
        {existingChannel && (
          <motion.button
            onClick={handleContinueGame}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.96 }}
            className="px-8 py-3 rounded-xl font-bold text-sm tracking-widest uppercase text-black"
            style={{
              background: 'linear-gradient(135deg, #c9922a, #a07010)',
              boxShadow: '0 4px 20px rgba(180,130,0,0.4)',
            }}
          >
            {t('continueGame')}
          </motion.button>
        )}
        <motion.button
          onClick={handleNewGame}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.96 }}
          className="px-8 py-3 rounded-xl font-bold text-sm tracking-widest uppercase text-white"
          style={{
            background: 'linear-gradient(135deg, #2a6a3a, #1a4a24)',
            boxShadow: '0 4px 20px rgba(40,120,60,0.4)',
          }}
        >
          {t('start')}
        </motion.button>
      </div>
    </div>
  );
};
