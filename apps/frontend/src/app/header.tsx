import React, { useEffect, useState } from 'react';
import useWebSocket from './use-websocket';
import { useRunnerStore } from '../stores/use-runner-store';
import { Role, useGameStore } from '../stores/use-game-store';


export const Header = () => {

  const { messages, sendMessage } = useWebSocket();
  const currentPosition = useRunnerStore((state) => state.currentPosition);
    const currentType = useRunnerStore((state) => state.currentType);
    const currentRole = useRunnerStore((state) => state.currentRole);
    const setCurrentRole = useRunnerStore((state) => state.setCurrentRole);
    const players = useGameStore((state) => state.players);

const onRoleChange = (role: Role) => {
  setCurrentRole(role);
  sendMessage(role);
};

  return (
    <div className='flex justify-center items-center gap-10'>
              <img className='w-36' src="/images/logo.jpg" alt="player"
            />
        <div className='flex flex-col gap-2'>
               <h1>Scotland Yard</h1>
      <div className='flex items-center'>

      <p>Player Role: {currentRole }</p>
        
      <img className='w-10' src={`/images/${currentRole}.png`} alt="player"
            />
      </div>
      <p>Current Position: {currentPosition}</p>
      <p>Current Type: {currentType}</p>
        </div>
   

     {players && (
        <div className='flex gap-2'>
          {players.map((p) => (
            <span key={p.id} >
                <img className='w-10 h-12' src={`/images/${p.role}.png`} alt="player"
                onClick={() => onRoleChange(p.role)}
            />
               <p>{p.position}</p>
            </span>
          ))}
        </div>
      )}
       {/* <button onClick={() => handleMove(player.position + 1)}>
        Move to {player.position + 1}
      </button> */}
    </div>
  );
};
