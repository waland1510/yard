import { mapData, showCulpritAtMoves } from '@yard/shared-utils';
import { Fragment } from 'react/jsx-runtime';
import { usePlayerSubscription } from '../../../hooks/use-player-subscription';
import { usePlayersSubscription } from '../../../hooks/use-players-subscription';
import { useGameStore } from '../../../stores/use-game-store';
import { useRunnerStore } from '../../../stores/use-runner-store';
import { getAvailableType } from '../../../utils/available-type';
import { isMoveAllowed } from '../../../utils/move-allowed';
import { AnimatedImage } from './animated-image';
import { useToast } from '@chakra-ui/react';

export const Nodes = () => {
  const players = usePlayersSubscription();
  const currentPosition = usePlayerSubscription().currentPosition;
  const {
    batchUpdate,
    currentRole: role,
    isSecret,
    isDouble,
  } = useRunnerStore();
  const toast = useToast();
  const runnerData = {
      position: players.find((p) => p.role === role)?.position,
      currentRole: players.find((p) => p.position === currentPosition)?.role,
    };
  const { moves, players: storePlayers } = useGameStore();
  const playerStorePosition = storePlayers.find(
    (p) => p.role === role
  )?.position;
  const handleSend = (position: number) => {
    const currentType =
      getAvailableType(position, runnerData.position, role) || 'taxi';

    if (currentType === 'river') {
      toast({
        title: 'This move requires a secret ticket',
        description: 'The secret ticket was selected for you',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    }

    batchUpdate({
      currentType,
      move: {
        role,
        type: currentType,
        position,
        secret: isSecret,
        double: isDouble,
      },
      currentPosition: position,
      isSecret: currentType === 'river',
    });
  };

  return (
    <>
      {/* Render all nodes and static elements first */}
      {mapData.nodes.map((node) => {
        const hasBus = node.bus && node.bus.length > 0;
        const hasUnderground = node.underground && node.underground.length > 0;
        if (node.id < 1) return null;

        const player = players.find(p => p.position === node.id);
        const shouldHideText = player?.role === 'culprit' &&
          (role === 'culprit' || showCulpritAtMoves.includes(moves.length));

        return (
          <g key={`static-${node.id}`}>
            {hasBus && (
              <circle
                cx={node.x}
                cy={node.y}
                r="18"
                fill="none"
                stroke="#080"
                strokeWidth="4"
              />
            )}
            {hasUnderground && (
              <circle
                cx={node.x}
                cy={node.y}
                r="22"
                fill="none"
                stroke="#d00"
                strokeWidth="4"
              />
            )}
            <circle
              cx={node.x}
              cy={node.y}
              r="14"
              fill={
                isMoveAllowed(
                  node.id,
                  playerStorePosition ?? runnerData.position,
                  role
                ) ?? 'white'
              }
              stroke="black"
              strokeWidth="4"
              onClick={() => handleSend(node.id)}
              strokeDasharray={node.river ? '5 5' : 'none'}
            />
            <text
              x={node.x}
              y={node.y + 5}
              textAnchor="middle"
              fontWeight="normal"
              fontSize={currentPosition === node.id ? '16' : '14'}
              fill={
                shouldHideText
                  ? 'transparent'
                  : currentPosition === node.id
                  ? 'purple'
                  : isMoveAllowed(
                      node.id,
                      playerStorePosition ?? runnerData.position,
                      role
                    )
                  ? 'white'
                  : 'black'
              }
              onClick={() => handleSend(node.id)}
            >
              {node.id}
            </text>
          </g>
        );
      })}

      {/* Render all animated images on top */}
      {mapData.nodes.map((node) => {
        if (node.id < 1) return null;
        const player = players.find((p) => p.position === node.id);
        const playerRole = player?.role;
        const playersNode = mapData.nodes.find(
          (n) => n.id === player?.previousPosition
        );
        const showImage =
          playerRole &&
          (playerRole !== 'culprit' ||
            role === 'culprit' ||
            (playerRole === 'culprit' &&
              showCulpritAtMoves.includes(moves.length)));

        if (!showImage) return null;

        return (
          <Fragment key={`player-${node.id}`}>
            <AnimatedImage
              href={`/images/${playerRole}.png`}
              previousX={playersNode?.x || node.x}
              previousY={playersNode?.y || node.y}
              targetX={node.x}
              targetY={node.y}
              isCurrentPlayer={playerRole === role}
              nodeId={node.id}
            />
          </Fragment>
        );
      })}
    </>
  );
};
