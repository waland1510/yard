import { GameMode } from '@yard/shared-utils';
import { createGame, getGameByChannel } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import useWebSocket from '../use-websocket';

interface ModeProps {
  setCurrentStep: (step: string) => void;
}

export const Mode = ({ setCurrentStep }: ModeProps) => {
  const setChannel = useGameStore((state) => state.setChannel);
  const handleNewGame = async (gameMode: GameMode) => {
    setCurrentStep('createGame');
    const {channel} = await createGame(gameMode);

    setChannel(channel);
    const game = await getGameByChannel(channel);
    useGameStore.setState(game[0]);
  };
  return (
    <div className="text-center">
      <p className="text-lg text-gray-700">Choose Game Mode</p>
      <div className="flex justify-center gap-4">
        <button
          onClick={() => handleNewGame('easy')}
          className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4"
        >
          Easy
        </button>
        <button
          onClick={() => handleNewGame('medium')}
          className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4"
        >
          Medium
        </button>
        <button
          onClick={() => handleNewGame('hard')}
          className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4"
        >
          Hard
        </button>
      </div>
    </div>
  );
};
