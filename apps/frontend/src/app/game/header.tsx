import { Badge, Text, Flex } from '@chakra-ui/react';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';
import { isMoveAllowed } from '../../utils/move-allowed';
import useWebSocket from '../use-websocket';
import { PlayerPosition } from './player-position';
import { FaMagnifyingGlass, FaMagnifyingGlassLocation } from 'react-icons/fa6';
import { showCulpritAtMoves } from '@yard/shared-utils';
import { FaEye } from 'react-icons/fa';
import { addMove } from '../../api';

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
  const move = useRunnerStore((state) => state.move);
  const setMove = useRunnerStore((state) => state.setMove);
  const isMagnifyEnabled = useRunnerStore((state) => state.isMagnifyEnabled);
  const setIsMagnifyEnabled = useRunnerStore(
    (state) => state.setIsMagnifyEnabled
  );

  const players = usePlayersSubscription();
  const currentPlayer = players.find((player) => player.role === currentRole);
  const gameId = useGameStore((state) => state.id);
  console.log({ gameId });

  const handleSend = () => {
    if (move) {
      sendMessage('makeMove', move);
      // addMove(move);
      setMove(null);
      if (currentRole === 'culprit') {
        setIsDouble(false);
        setIsSecret(false);
      }
    }
  };
  const toggleMagnify = () => {
    setIsMagnifyEnabled(!isMagnifyEnabled);
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
    <div className="flex px-4 justify-around items-center gap-10">
      <Badge colorScheme="orange">Round: {movesCount}</Badge>
      <Badge colorScheme="blue">
        <Flex alignItems={'center'} gap={2}>
          <FaEye />
          <Text>{showCulpritAtMoves.find((move) => move >= movesCount)}</Text>
        </Flex>
      </Badge>
      <Flex alignItems={'center'}>
        {currentPlayer ? (
          <PlayerPosition position={currentPlayer.position} />
        ) : null}
        <Badge colorScheme={getStatusColorScheme()}>{currentType}</Badge>
        {currentPosition && currentPosition !== currentPlayer?.position ? (
          <svg width="30" height="30">
            <polygon points="20,15 0,5 0,25" fill="black" />
          </svg>
        ) : null}

        {currentPosition && currentPosition !== currentPlayer?.position ? (
          <PlayerPosition position={currentPosition} />
        ) : null}
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
          <Badge colorScheme={isSecret ? 'red' : 'gray'}>
            <p className={isSecret ? 'text-2xl font-black' : 'text-sm'}>
              Secret
            </p>
          </Badge>
          <Badge colorScheme={isDouble ? 'red' : 'gray'}>
            <p className={isDouble ? 'text-2xl font-black' : 'text-sm'}>
              Double
            </p>
          </Badge>
        </>
      ) : (
        <Badge colorScheme={isDoubleMove ? 'red' : 'gray'}>
          <p className={isDoubleMove ? 'text-2xl font-black' : 'text-sm'}>
            Double
          </p>
        </Badge>
      )}
      {isMagnifyEnabled ? (
        <Badge
          colorScheme="green"
          w={26}
          h={6}
          display="flex"
          alignSelf="center"
          onClick={toggleMagnify}
        >
          <FaMagnifyingGlass size={20} />
        </Badge>
      ) : (
        <Badge
          colorScheme="gray"
          w={26}
          h={6}
          display="flex"
          alignSelf="center"
          onClick={toggleMagnify}
        >
          <FaMagnifyingGlassLocation size={20} />
        </Badge>
      )}
    </div>
  );
};
