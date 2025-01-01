import React, { useEffect, useState } from 'react';
import useWebSocket from './use-websocket';


export const Header = () => {
  const [gameState, setGameState] = useState(null);
  const [player, setPlayer] = useState({ role: 'detective', position: 1 });
  const { messages, sendMessage } = useWebSocket();
  useEffect(() => {

  }, [player]);

  return (
    <div>
      <h1>Scotland Yard</h1>
      <p>Player Role: {player.role}</p>
      {/* {gameState?.players && (
        <ul>
          {gameState.players.map((p) => (
            <li key={p.id}>
              {p.role} at position {p.position}
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => handleMove(player.position + 1)}>
        Move to {player.position + 1}
      </button> */}
    </div>
  );
};
