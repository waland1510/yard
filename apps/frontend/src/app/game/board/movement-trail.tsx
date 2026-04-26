import { mapData } from '@yard/shared-utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../../stores/use-game-store';

const ROLE_COLORS: Record<string, string> = {
  detective1: '#4fc3f7',
  detective2: '#81c784',
  detective3: '#ce93d8',
  detective4: '#ffb74d',
  detective5: '#4db6ac',
  culprit: '#aaaaaa',
};

export const MovementTrail = () => {
  const players = useGameStore((s) => s.players);

  return (
    <AnimatePresence>
      {players.map((player) => {
        if (
          !player.previousPosition ||
          player.previousPosition === player.position
        )
          return null;

        const prevNode = mapData.nodes.find(
          (n) => n.id === player.previousPosition
        );
        if (!prevNode) return null;

        const color = ROLE_COLORS[player.role] ?? '#ffffff';

        return (
          <motion.circle
            key={`trail-${player.role}-${player.previousPosition}`}
            cx={prevNode.x}
            cy={prevNode.y}
            r={14}
            fill={color}
            initial={{ opacity: 0.55, scale: 1 }}
            animate={{ opacity: 0, scale: 2.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            pointerEvents="none"
          />
        );
      })}
    </AnimatePresence>
  );
};
