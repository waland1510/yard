import React, { useEffect, useState } from 'react';
import useWebSocket from './use-websocket';
import { useRunnerStore } from '../stores/use-runner-store';
import { ClientGameState, useGameStore } from '../stores/use-game-store';
import { usePlayersSubscription } from '../hooks/use-players-subscription';
import { usePlayerSubscription } from '../hooks/use-player-subscription';
import { useNavigate } from 'react-router-dom';
import { RoleType } from '@yard/shared-utils';

export const Header = () => {
  const existingChannel = useGameStore((state) => state.channel);
  const { sendMessage } = useWebSocket(existingChannel);
  const currentPosition = useRunnerStore((state) => state.currentPosition);
  const currentType = useRunnerStore((state) => state.currentType);
  const currentRole = useRunnerStore((state) => state.currentRole);
  const currentTurn = useGameStore((state) => state.currentTurn);
  const movesCount = useGameStore((state) => state.movesCount);
  const setCurrentRole = useRunnerStore((state) => state.setCurrentRole);
  const setCurrentPosition = useRunnerStore(
    (state) => state.setCurrentPosition
  );
  const players = usePlayersSubscription();
  const setGameMode = useGameStore((state) => state.setGameMode);
  const navigate = useNavigate();

  const onRoleChange = (role: RoleType) => {
    setCurrentRole(role);
    const currentPlayer = players.find((p) => p.role === role);
    if (currentPlayer) {
      setCurrentPosition(currentPlayer.position);
    }

    sendMessage('updateGameState', role);
  };

  return (
    <div className="flex justify-around items-center gap-10 h-10">
      <img
        className="w-20"
        src="/images/logo.jpg"
        alt="player"
        onClick={() => navigate('/')}
      />
      <div className="flex flex-col gap-2">
        {currentRole ? (
          <div className="flex items-center">
            <img
              className="w-10"
              src={`/images/${currentRole}.png`}
              alt="player"
            />
          </div>
        ) : (
          <p>Select a player to start</p>
        )}
      </div>
      {
        currentRole === currentTurn &&
        <button
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Your Turn
        </button>
      }
      <p>Moves: {movesCount}</p>
      <p>Current Position: {currentPosition}</p>
      <p>Current Type: {currentType}</p>

      {players && (
        <div className="flex gap-2">
          {players.map((p) => (
            <span key={p.id}>
              <img
                className="w-10 h-12"
                src={`/images/${p.role}.png`}
                alt="player"
                onClick={() => onRoleChange(p.role)}
              />
              <p>{p.position}</p>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
