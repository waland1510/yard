import { showCulpritAtMoves } from '@yard/shared-utils';
import { useCallback, useMemo } from 'react';
import { Fragment } from 'react/jsx-runtime';
import { usePlayerSubscription } from '../../../hooks/use-player-subscription';
import { usePlayersSubscription } from '../../../hooks/use-players-subscription';
import { useGameStore } from '../../../stores/use-game-store';
import { useRunnerStore } from '../../../stores/use-runner-store';
import { getAvailableType } from '../../../utils/available-type';
import { isMoveAllowed } from '../../../utils/move-allowed';
import { mapData } from '../board-data/grid_map';
import { AnimatedImage } from './animated-image';

export const Nodes = () => {
  const players = usePlayersSubscription();
  const currentPosition = usePlayerSubscription().currentPosition;
  const {
    setCurrentType,
    currentRole: role,
    isSecret,
    isDouble,
    setMove,
    setCurrentPosition,
  } = useRunnerStore();

  const runnerData = useMemo(
    () => ({
      position: players.find((p) => p.role === role)?.position,
      currentRole: players.find((p) => p.position === currentPosition)?.role,
    }),
    [players, role, currentPosition]
  );
  const { moves, players: storePlayers } = useGameStore();
  const playerStorePosition = storePlayers.find(
    (p) => p.role === role
  )?.position;
  const handleSend = useCallback(
    (position: number) => {
      const availableType =
        getAvailableType(position, runnerData.position, role) || 'taxi';

      setCurrentType(availableType);
      setMove({
        role,
        type: availableType,
        position,
        secret: isSecret,
        double: isDouble,
      });
      setCurrentPosition(position);
    },
    [
      runnerData.position,
      role,
      setCurrentType,
      setMove,
      isSecret,
      isDouble,
      setCurrentPosition,
    ]
  );

  return (
    <>
      {mapData.nodes.map((node) => {
        const hasBus = node.bus && node.bus.length > 0;
        const hasUnderground = node.underground && node.underground.length > 0;
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
        return (
          <Fragment key={node.id}>
            <g>
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
                    playerStorePosition,
                    runnerData.currentRole
                  ) ?? 'white'
                }
                stroke="black"
                strokeWidth="4"
                onClick={() => handleSend(node.id)}
                strokeDasharray={node.river ? '5 5' : 'none'}
              />
              <defs>
                <clipPath id={`clip-circle-${node.id}`}>
                  <circle cx={node.x} cy={node.y} r="14" />
                </clipPath>
              </defs>
              {showImage && (
                <AnimatedImage
                  href={`/images/${playerRole}.png`}
                  previousX={playersNode?.x || node.x}
                  previousY={playersNode?.y || node.y}
                  targetX={node.x}
                  targetY={node.y}
                  isCurrentPlayer={playerRole === role}
                  nodeId={node.id}
                />
              )}
              <text
                x={node.x}
                y={node.y + 5}
                textAnchor="middle"
                fontWeight={showImage ? 'bold' : 'normal'}
                fontSize={currentPosition === node.id ? '16' : '14'}
                fill={
                  showImage
                    ? 'transparent'
                    : currentPosition === node.id
                    ? 'purple'
                    : isMoveAllowed(
                        node.id,
                        runnerData.position,
                        runnerData.currentRole
                      )
                    ? 'white'
                    : 'black'
                }
                onClick={() => handleSend(node.id)}
              >
                {node.id}
              </text>
            </g>
          </Fragment>
        );
      })}
    </>
  );
};
