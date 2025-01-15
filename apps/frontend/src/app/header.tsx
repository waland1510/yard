import React, { useEffect, useState } from 'react';
import useWebSocket from './use-websocket';
import { useRunnerStore } from '../stores/use-runner-store';
import { ClientGameState, useGameStore } from '../stores/use-game-store';
import { usePlayersSubscription } from '../hooks/use-players-subscription';
import { usePlayerSubscription } from '../hooks/use-player-subscription';
import { useNavigate } from 'react-router-dom';
import { RoleType } from '@yard/shared-utils';
import { isMoveAllowed } from '../utils/move-allowed';

export const Header = () => {
  const existingChannel = useGameStore((state) => state.channel);
  const { sendMessage } = useWebSocket(existingChannel);
  const currentPosition = useRunnerStore((state) => state.currentPosition);
  const currentType = useRunnerStore((state) => state.currentType);
  const isSecret = useRunnerStore((state) => state.isSecret);
  const setIsSecret = useRunnerStore((state) => state.setIsSecret);
  const isDouble = useRunnerStore((state) => state.isDouble);
  const setIsDouble = useRunnerStore((state) => state.setIsDouble);
  const isDoubleMove = useGameStore((state) => state.isDoubleMove);
  const currentRole = useRunnerStore((state) => state.currentRole);
  const currentTurn = useGameStore((state) => state.currentTurn);
  const movesCount = useGameStore((state) => state.movesCount);
  const setCurrentRole = useRunnerStore((state) => state.setCurrentRole);
  const move = useRunnerStore((state) => state.move);
  const setMove = useRunnerStore((state) => state.setMove);
  const setCurrentPosition = useRunnerStore(
    (state) => state.setCurrentPosition
  );
  const players = usePlayersSubscription();
  const setGameMode = useGameStore((state) => state.setGameMode);
  const navigate = useNavigate();
  const username = sessionStorage.getItem('username');
  const onRoleChange = (role: RoleType) => {
    setCurrentRole(role);
    const currentPlayer = players.find((p) => p.role === role);
    if (currentPlayer) {
      setCurrentPosition(currentPlayer.position);
    }

    sendMessage('updateGameState', role);
    sendMessage('impersonate', { role, username });
  };

  const handleSend = () => {
    if (move) {
      sendMessage('makeMove', move);
      setMove(null);
      if (currentRole === 'culprit') {
        setIsDouble(false);
        setIsSecret(false);
      }
    }
    // sendMessage('makeMove', { role: currentRole, target: id.toString() });
  };
  return (
    <div className="flex justify-around items-center gap-10 h-16">
      <img
        className="w-20"
        src="/images/logo.jpg"
        alt="player"
        onClick={() => navigate('/')}
      />
      <div className="flex flex-col gap-2">
        {currentRole ? (
          <div className="flex items-center gap-4">
            <img
              className="w-10"
              src={`/images/${currentRole}.png`}
              alt="player"
            />
            <p>{username}</p>
          </div>
        ) : (
          <p>Select a player to start</p>
        )}
      </div>
      {currentRole === currentTurn && (() => {
  const currentPlayer = players.find((player) => player.role === currentRole);
  const isAllowed = move && isMoveAllowed(move.position, currentPlayer?.position, currentType, isSecret);

  return (
    <div>
      {isAllowed ? (
        <button
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          onClick={handleSend}
        >
          Confirm {move.position}
        </button>
      ) : (
        <button
          className="bg-red-500 text-white font-bold py-2 px-4 rounded cursor-not-allowed"
          disabled
        >
          {move ? 'Invalid Move' : 'Your Turn'}
        </button>
      )}
    </div>
  );
})()}
      <p>Moves: {movesCount}</p>
      <p>Current Position: {currentPosition}</p>
      <p>Current Type: {currentType}</p>
      {currentRole === 'culprit' ? (
        <>
          {' '}
          <p
            className={
              isSecret ? 'text-2xl font-black text-red-700' : 'text-sm'
            }
          >
            Secret
          </p>
          <p
            className={
              isDouble ? 'text-2xl font-black text-red-700' : 'text-sm'
            }
          >
            Double
          </p>
        </>
      ) : (
        <p
          className={
            isDoubleMove ? 'text-2xl font-black text-red-700' : 'text-sm'
          }
        >
          Double
        </p>
      )}

      {players && (
        <div className="flex gap-2 items-end">
          {players.map((p) => (
            <span key={p.id}>
              <p>{p.username}</p>
              <img
                className="w-10 h-12"
                src={`/images/${p.role}.png`}
                alt="player"
                onClick={
                  currentRole !== 'culprit' && p.role !== 'culprit'
                    ? () => onRoleChange(p.role)
                    : undefined
                }
              />
              {p.role !== 'culprit' ? <p>{p.position}</p> : <p>??</p>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
