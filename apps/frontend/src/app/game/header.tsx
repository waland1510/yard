import React, { useEffect, useState } from 'react';
import useWebSocket from '../use-websocket';
import { useRunnerStore } from '../../stores/use-runner-store';
import { ClientGameState, useGameStore } from '../../stores/use-game-store';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { usePlayerSubscription } from '../../hooks/use-player-subscription';
import { useNavigate } from 'react-router-dom';
import { RoleType } from '@yard/shared-utils';
import { isMoveAllowed } from '../../utils/move-allowed';
import { patchPlayer } from '../../api';
import { Badge, Flex, Text } from '@chakra-ui/react';
import { mapData } from './board-data/grid_map';

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
  const currentPlayer = players.find((player) => player.role === currentRole);
  console.log('players', players);
  const positionNode = (position: number) => {
    const node = mapData.nodes.find((node) => node.id === position);
    if (!node) {
      return null;
    }

    const hasBus = node.bus && node.bus.length > 0;
    const hasUnderground = node.underground && node.underground.length > 0;
    return (
      <svg width="52" height="52">
        <g>
          {hasBus && (
            <circle
              cx={25}
              cy={25}
              r="21"
              fill="none"
              stroke="#0db708"
              strokeWidth="3"
            />
          )}
          {hasUnderground && (
            <circle
              cx={25}
              cy={25}
              r="24"
              fill="none"
              stroke="#ed0013"
              strokeWidth="3"
            />
          )}
          <circle
            cx={25}
            cy={25}
            r="18"
            fill="white"
            stroke="black"
            strokeWidth="3"
            // onClick={() => handleSend(node.id)}
            strokeDasharray={node.river ? '5 5' : 'none'}
          />
          <text
            x={25}
            y={30}
            textAnchor="middle"
            fontWeight="bold"
            fontSize="16"
            fill="black"
          >
            {position}
          </text>
        </g>
      </svg>
    );
  };
  const setGameMode = useGameStore((state) => state.setGameMode);
  const navigate = useNavigate();
  const username = sessionStorage.getItem('username');
  // const onRoleChange = (role: RoleType) => {
  //   setCurrentRole(role);
  //   const currentPlayer = players.find((p) => p.role === role);
  //   if (currentPlayer) {
  //     setCurrentPosition(currentPlayer.position);
  //     patchPlayer(currentPlayer.id, { username: username as string });
  //   }

  //   sendMessage('updateGameState', role);
  //   sendMessage('impersonate', { role, username });
  // };

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

  const getStatusColorScheme = () => {
    switch (currentType) {
      case 'taxi':
        return 'yellow';
      case 'bus':
        return 'green';
      case 'underground':
        return 'red';
      default:
        return 'gray';
    }
  };
  return (
    <div className="flex justify-around items-center gap-10">
      {/* <div className="flex flex-col gap-2">
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
      </div> */}

      <Badge colorScheme="orange">Moves: {movesCount}</Badge>
      <Badge colorScheme="red">{currentPosition}</Badge>
      <Flex alignItems={'center'}>
      {currentPlayer ? positionNode(currentPlayer?.position) : null}
      <Badge colorScheme={getStatusColorScheme()}>{currentType}</Badge>
        {currentPosition && currentPosition !== currentPlayer?.position ? (
          <svg width="30" height="30">
            <polygon points="20,15 0,5 0,25" fill="black" />
          </svg>
        ) : null}

        {currentPosition && currentPosition !== currentPlayer?.position
          ? positionNode(currentPosition)
          : null}

      </Flex>
      {currentRole === currentTurn &&
        (() => {
          const isAllowed =
            move &&
            isMoveAllowed(
              move.position,
              currentPlayer?.position,
              currentType,
              isSecret
            );

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
        <Badge colorScheme={isDoubleMove ? 'red' : 'gray'}>
          <p className={isDoubleMove ? 'text-2xl font-black' : 'text-sm'}>
            Double
          </p>
        </Badge>
      )}

      {/* {players && (
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
      )} */}
    </div>
  );
};
