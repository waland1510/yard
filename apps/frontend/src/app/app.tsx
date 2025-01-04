import { useEffect, useState } from 'react';
import { Header } from './header';
import GameBoard from './map';
import { Panel } from './panel';
import { useGameStore } from '../stores/use-game-store';
import {
  easyPositions,
  hardPositions,
  mediumPositions,
} from './starting-positions';
import { send } from 'process';
import useWebSocket from './use-websocket';
// import WebSocketClient from './websocket-client';

export function App() {
 const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const setPosition = useGameStore((state) => state.setPosition);
  const game = useGameStore((state) => state);
  const { sendMessage } = useWebSocket();
  useEffect(() => {
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
    sendMessage('updateGameState', game);
  }, [gameMode]);
  
  return (
    <div className="grid grid-cols-12 gap-4 p-4">
      <div className="col-span-12 mb-4 text-center">
        {gameMode ? (
          <>
          <Header />
         <button
           onClick={() => setGameMode(undefined)}
           className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
         >
           Reset Game
         </button>
          </>

        ) : (
          <>
            <button
              onClick={() => setGameMode('easy')}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Easy
            </button>
            <button
              onClick={() => setGameMode('medium')}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Medium
            </button>
            <button
              onClick={() => setGameMode('hard')}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Hard
            </button>
          </>
        )}
      </div>
      <div className="col-span-1">
        {/* <WebSocketClient /> */}
        <Panel />
      </div>
      <div className="col-span-11">
        <GameBoard />
      </div>
    </div>
  );
}

export default App;
