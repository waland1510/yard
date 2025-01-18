import { mapData } from '../board-data/grid_map';
import { useRunnerStore } from '../../../stores/use-runner-store';
import { usePlayersSubscription } from '../../../hooks/use-players-subscription';
import { usePlayerSubscription } from '../../../hooks/use-player-subscription';
import { useGameStore } from '../../../stores/use-game-store';
import { isMoveAllowed } from '../../../utils/move-allowed';
import { showCulpritAtMoves } from '@yard/shared-utils';

export const Nodes = () => {
  const players = usePlayersSubscription();
  const currentPosition = usePlayerSubscription().currentPosition;
  const type = useRunnerStore((state) => state.currentType);
  const role = useRunnerStore((state) => state.currentRole);
  const isSecret = useRunnerStore((state) => state.isSecret);
  const isDouble = useRunnerStore((state) => state.isDouble);
  const setMove = useRunnerStore((state) => state.setMove);
  const setCurrentPosition = useRunnerStore(
    (state) => state.setCurrentPosition
  );
  const runnerPosition = players.find((p) => p.role === role)?.position;
  const movesCount = useGameStore((state) => state.movesCount);

  const handleSend = (position: number) => {
    setMove({
      role,
      type,
      position,
      isSecret,
      isDouble,
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
              showCulpritAtMoves.includes(movesCount)));
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
                  ? 'red'
                  : isMoveAllowed(node.id, runnerPosition, type, isSecret)
                  ? 'orange'
                  : 'black'
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
