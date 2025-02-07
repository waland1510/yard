import { Badge, Text, Flex, VStack, Button, Image } from '@chakra-ui/react';
import { usePlayersSubscription } from '../../hooks/use-players-subscription';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';
import { isMoveAllowed } from '../../utils/move-allowed';
import useWebSocket from '../use-websocket';
import { PlayerPosition } from './player-position';
import {
  FaMagnifyingGlass,
  FaMagnifyingGlassLocation,
  FaEye,
} from 'react-icons/fa6';
import { getNextRole, MoveType, showCulpritAtMoves } from '@yard/shared-utils';
import { addMove, updateGame, updatePlayer } from '../../api';
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const { sendMessage } = useWebSocket(channel);
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
        updateGame(gameId, { status: 'finished' });
        sendMessage('endGame', { winner: currentRole });
        return;
      }
      if (
        currentRole === 'culprit' &&
        detectivesPositions.includes(move.position)
      ) {
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
  const toggleMagnify = () => setIsMagnifyEnabled(!isMagnifyEnabled);

  const getStatusColorScheme = (type: MoveType | 'secret') => {
    switch (type) {
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
  const lastCulpritMove = culpritMoves[culpritMoves.length - 1];
  const lastCulpritMoveType = lastCulpritMove?.secret
    ? 'secret'
    : lastCulpritMove?.type;

  const allowed =
    move &&
    isMoveAllowed(move.position, currentPlayer?.position, currentPlayer?.role);
  return (
    <VStack
      w="100%"
      bg="#8CC690"
      p={4}
      borderRadius="md"
      spacing={4}
      color="white"
    >
      <Flex
        direction="column"
        align="center"
        w="120px"
        bg="#ACD8AF"
        p={4}
        borderRadius="md"
        gridGap={2}
      >
        {currentPlayer && <PlayerPosition position={currentPlayer.position} />}
        <Badge colorScheme={getStatusColorScheme(currentType)}>
          {t(currentType)}
        </Badge>
        {currentPosition && currentPosition !== currentPlayer?.position ? (
          <PlayerPosition position={currentPosition} />
        ) : null}
      </Flex>
      {currentRole === currentTurn && move && (
        <Button
          colorScheme={move ? 'green' : 'red'}
          onClick={handleSend}
          isDisabled={!allowed}
        >
          {allowed ? `Confirm ${move.position}` : t('invalidMove')}
        </Button>
      )}
      {currentRole === 'culprit' && (
        <Flex gap={2}>
          <Badge colorScheme={isSecret ? 'red' : 'gray'}>
            {isSecret ? t('secret') : t('normal')}
          </Badge>
          <Badge colorScheme={isDouble ? 'red' : 'gray'}>
            {isDouble ? t('double') : t('single')}
          </Badge>
        </Flex>
      )}
      <Button
        w={120}
        onClick={toggleMagnify}
        leftIcon={
          isMagnifyEnabled ? (
            <FaMagnifyingGlass />
          ) : (
            <FaMagnifyingGlassLocation />
          )
        }
      >
        {isMagnifyEnabled ? t('disable') : t('enable')}
      </Button>
      <Flex
        direction="column"
        align="center"
        bg="#ACD8AF"
        w="120px"
        p={4}
        borderRadius="md"
        gridGap={2}
      >
        <Image src="/images/culprit.png" w={10} />
        <Badge colorScheme="orange">{t('round')}: {culpritMoves.length}</Badge>
        <Badge colorScheme={getStatusColorScheme(lastCulpritMoveType)}>
          {lastCulpritMoveType}
        </Badge>
        {showCulpritAtMoves.includes(culpritMoves.length) ? (
          <PlayerPosition position={lastCulpritMove?.position} />
        ) : (
          <Badge colorScheme="blue">
            <Flex alignItems="center" gap={2}>
              <FaEye />{' '}
              <Text>
                {showCulpritAtMoves.find((move) => move >= culpritMoves.length)}
              </Text>
            </Flex>
          </Badge>
        )}
        <Badge colorScheme={isDoubleMove ? 'red' : 'gray'}>
          {isDoubleMove ? t('double') : t('single')}
        </Badge>
      </Flex>
    </VStack>
  );
};
