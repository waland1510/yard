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
  const { sendMessage } = useWebSocket('');
  const handleNewGame = async () => {
    const { createdGame } = await createGame();

    useGameStore.setState(createdGame);
    if (createdGame) {
      setCurrentStep('createGame');
      sendMessage('startGame', { ch: createdGame.channel });
    }
  };
  return (
    <div className="text-center">
      <p className="text-lg text-gray-700">
        {existingChannel && 'Welcome back!'}
      </p>
      {existingChannel && (
        <button
          className="px-6 py-2 bg-yellow-600 text-black rounded-lg shadow-md hover:bg-red-700 transition duration-300"
          onClick={handleContinueGame}
        >
          Continue Existing Game
        </button>
      )}
      <button
        className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300"
        onClick={() => {
          setCurrentStep('addUsername');
          handleNewGame();
        }}
      >
        Start New Game
      </button>
    </div>
  );
};
