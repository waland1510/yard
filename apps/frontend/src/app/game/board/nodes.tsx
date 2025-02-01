import { showCulpritAtMoves } from '@yard/shared-utils';
import { usePlayerSubscription } from '../../../hooks/use-player-subscription';
import { usePlayersSubscription } from '../../../hooks/use-players-subscription';
import { useGameStore } from '../../../stores/use-game-store';
import { useRunnerStore } from '../../../stores/use-runner-store';
import { getAvailableType } from '../../../utils/available-type';
import { isMoveAllowed } from '../../../utils/move-allowed';
import { mapData } from '../board-data/grid_map';

export const Nodes = () => {
  const players = usePlayersSubscription();
  const currentPosition = usePlayerSubscription().currentPosition;
  const setCurrentType = useRunnerStore((state) => state.setCurrentType);
  const role = useRunnerStore((state) => state.currentRole);
  const isSecret = useRunnerStore((state) => state.isSecret);
  const isDouble = useRunnerStore((state) => state.isDouble);
  const setMove = useRunnerStore((state) => state.setMove);
  const setCurrentPosition = useRunnerStore(
    (state) => state.setCurrentPosition
  );
  const runnerPosition = players.find((p) => p.role === role)?.position;
  const runnerRole = players.find((p) => p.position === currentPosition)?.role;
  const moves = useGameStore((state) => state.moves);

  const handleSend = (position: number) => {
    const availableType = getAvailableType(position, runnerPosition, role) || 'taxi';
    setCurrentType(availableType);
    setMove({
      role,
      type: availableType,
      position,
      secret: isSecret,
      double: isDouble,
    });
    setCurrentPosition(position);
  };
  return (
    <>
      {mapData.nodes.map((node) => {
        const hasBus = node.bus && node.bus.length > 0;
        const hasUnderground = node.underground && node.underground.length > 0;
        if (node.id < 1) return null;
        const playerRole = players.find((p) => p.position === node.id)?.role;
        const showImage =
          playerRole &&
          (playerRole !== 'culprit' ||
            role === 'culprit' ||
            (playerRole === 'culprit' &&
              showCulpritAtMoves.includes(moves.length)));
        return (
          <g key={node.id}>
            {hasBus && (
              <circle
                cx={node.x}
                cy={node.y}
                r="18"
                fill="none"
                stroke="#0db708"
                strokeWidth="4"
              />
            )}
            {hasUnderground && (
              <circle
                cx={node.x}
                cy={node.y}
                r="22"
                fill="none"
                stroke="#ed0013"
                strokeWidth="4"
              />
            )}
            <circle
              cx={node.x}
              cy={node.y}
              r="14"
              fill="white"
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
              <image
                href={`/images/${playerRole}.png`}
                x={node.x - 14}
                y={node.y - 14}
                width="28"
                height="28"
                clipPath={`url(#clip-circle-${node.id})`}
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
                  : isMoveAllowed(node.id, runnerPosition, runnerRole) ?? 'black'
              }
              onClick={() => handleSend(node.id)}
            >
              {node.id}
            </text>
          </g>
        );
      })}
    </>
  );
};
