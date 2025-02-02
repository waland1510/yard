import { Badge, Text, Flex, useToast } from '@chakra-ui/react';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';
import { isMoveAllowed } from '../../utils/move-allowed';
import useWebSocket from '../use-websocket';
import { PlayerPosition } from './player-position';
import { FaMagnifyingGlass, FaMagnifyingGlassLocation } from 'react-icons/fa6';
import { getNextRole, showCulpritAtMoves } from '@yard/shared-utils';
import { FaEye } from 'react-icons/fa';
import { addMove, updateGame, updatePlayer } from '../../api';

export const Header = () => {
  const {
    channel,
    currentTurn,
    moves,
    isDoubleMove,
    id: gameId,
  } = useGameStore();

  const {
    currentPosition,
    currentType,
    isSecret,
    setIsSecret,
    isDouble,
    setIsDouble,
    currentRole,
    move,
    setMove,
    isMagnifyEnabled,
    setIsMagnifyEnabled,
  } = useRunnerStore();

  const { sendMessage } = useWebSocket(channel);
  const toast = useToast();

  const players = usePlayersSubscription();
  const currentPlayer = players.find((player) => player.role === currentRole);
  const culpritPosition = players.find(
    (player) => player.role === 'culprit'
  )?.position;
  const detectivesPositions = players
    .filter((player) => player.role !== 'culprit')
    .map((player) => player.position);

  const handleSend = () => {
    if (move && gameId && currentRole && currentPlayer) {
      if (currentRole !== 'culprit' && move.position === culpritPosition) {
        toast({
          title: 'Game Over',
          position: 'top',
          description: 'You caught Mr. C',
          status: 'success',
          duration: 9000,
          isClosable: true,
        });
        localStorage.removeItem('channel');
        updateGame(gameId, { status: 'finished' });
        sendMessage('endGame', { winner: currentRole });
        return;
      }
      if (
        currentRole === 'culprit' &&
        detectivesPositions.includes(move.position)
      ) {
        toast({
          title: 'Move Invalid',
          description: 'You cannot move to detective position',
          status: 'error',
          duration: 9000,
          isClosable: true,
        });
        return;
      }

      sendMessage('makeMove', move);
      addMove({
        gameId,
        type: move.type,
        role: move.role,
        position: move.position,
        secret: isSecret,
        double: isDouble,
      });
      updatePlayer(currentPlayer.id, {
        position: move.position,
        previousPosition: currentPlayer.position,
      });
      updateGame(gameId, { currentTurn: getNextRole(currentRole, isDouble) });
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

  const culpritMoves = moves.filter((move) => move.role === 'culprit');
  return (
    <div className="flex px-4 justify-around items-center gap-10">
      <Badge colorScheme="orange">Round: {culpritMoves.length}</Badge>
      <Badge colorScheme="blue">
        <Flex alignItems={'center'} gap={2}>
          <FaEye />
          <Text>{showCulpritAtMoves.find((move) => move >= culpritMoves.length)}</Text>
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
              currentPlayer?.role
            );
          return (
            <div>
              {isAllowed ? (
                currentType ? (
                  <button
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    onClick={handleSend}
                  >
                    Confirm {move.position}
                  </button>
                ) : (
                  <button className="bg-yellow-500 hover:bg-yellow-700 text-black font-bold py-2 px-4 rounded">
                    Select a transport
                  </button>
                )
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
