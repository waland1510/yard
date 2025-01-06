import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameMode, useGameStore } from '../stores/use-game-store';
import {
  easyPositions,
  hardPositions,
  mediumPositions,
} from './starting-positions';
import useWebSocket from './use-websocket';

export const Setup = () => {
  // let channel: string | undefined = undefined;
  const existingChannel = useGameStore((state) => state.channel);
  const navigate = useNavigate();
  const setGameMode = useGameStore((state) => state.setGameMode);
  const game = useGameStore((state) => state);
  const setPosition = useGameStore((state) => state.setPosition);
  const setChannel = useGameStore((state) => state.setChannel);
  const [newGame, setNewGame] = useState(false);

  // useEffect(() => {
  //   if (newGame) {
  const channel = Math.random().toString(36).substring(7);
  //   }
  // }, [newGame]);

  const { sendMessage } = useWebSocket(channel);
  const handleNewGame = (gameMode: GameMode) => {
    setChannel(channel);
    if (channel) {
      sendMessage('startGame', channel);
      useGameStore.setState({ channel });
      const startingPositions = (() => {
        switch (gameMode) {
          case 'easy':
            setGameMode('easy');
            return easyPositions[
              Math.floor(Math.random() * easyPositions.length)
            ];
          case 'medium':
            setGameMode('medium');
            return mediumPositions[
              Math.floor(Math.random() * mediumPositions.length)
            ];
          case 'hard':
            setGameMode('hard');
            return hardPositions[
              Math.floor(Math.random() * hardPositions.length)
            ];
          default:
            return easyPositions[
              Math.floor(Math.random() * easyPositions.length)
            ];
        }
      })();
      if (!startingPositions) return;
      Object.entries(startingPositions).forEach(([role, position]) =>
        setPosition(role, position)
      );
      console.log({ channel });
      sendMessage('updateGameState', game);
      navigate(`/game/${channel}`);
    }
  };

  const handleContinueGame = () => {
    navigate(`/game/${existingChannel}`);
  };

  return (
    <div className="flex flex-col gap-5 items-center justify-center h-screen bg-white">
      <img
        className="w-96 rounded mb-6"
        src="/images/logo.jpg"
        alt="Game Logo"
      />
      <div className="text-center">
        <p className="text-lg text-gray-700">
          {existingChannel ? 'Welcome back!' : 'Welcome to the Game'}
        </p>
      </div>
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
        onClick={() => setNewGame(true)}
      >
        New Game
      </button>
      {newGame && (
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
      )}
    </div>
  );
};
