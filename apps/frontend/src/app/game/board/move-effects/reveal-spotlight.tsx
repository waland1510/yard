import { showCulpritAtMoves } from '@yard/shared-utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../../../stores/use-game-store';
import { useNodesStore } from '../../../../stores/use-nodes-store';

interface Spotlight {
  id: string;
  x: number;
  y: number;
  color: string;
}

export const RevealSpotlight = () => {
  const moves = useGameStore((s) => s.moves);
  const theme = useGameStore((s) => s.theme);
  const nodes = useNodesStore((s) => s.nodes);
  const processed = useRef(moves.length);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);

  useEffect(() => {
    if (moves.length <= processed.current) {
      processed.current = moves.length;
      return;
    }
    const startIdx = processed.current;
    const newMoves = moves.slice(startIdx);
    processed.current = moves.length;

    newMoves.forEach((m, i) => {
      if (m.role !== 'culprit') return;
      const culpritRound = moves
        .slice(0, startIdx + i + 1)
        .filter((x) => x.role === 'culprit').length;
      if (!showCulpritAtMoves.includes(culpritRound)) return;
      const node = nodes.find((n) => n.id === Number(m.position));
      if (!node) return;
      const color = theme === 'harry-potter' ? '#ffd700' : '#ff6b35';
      const id = `${Date.now()}-${i}`;
      setSpotlights((prev) => [...prev, { id, x: node.x, y: node.y, color }]);
      window.setTimeout(() => {
        setSpotlights((prev) => prev.filter((s) => s.id !== id));
      }, 2000);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves.length]);

  return (
    <AnimatePresence>
      {spotlights.map((s) => (
        <motion.g key={s.id} pointerEvents="none">
          {/* Expanding rings */}
          {[0, 0.2, 0.4].map((delay, i) => (
            <motion.circle
              key={i}
              cx={s.x}
              cy={s.y}
              fill="none"
              stroke={s.color}
              strokeWidth={4}
              initial={{ r: 0, opacity: 1 }}
              animate={{ r: [0, 70, 100], opacity: [1, 0.4, 0] }}
              transition={{ duration: 1.5, delay, ease: 'easeOut' }}
            />
          ))}
          {/* Spotlight glow */}
          <motion.circle
            cx={s.x}
            cy={s.y}
            fill={s.color}
            initial={{ r: 0, opacity: 0 }}
            animate={{ r: [0, 30, 25], opacity: [0, 0.5, 0] }}
            transition={{ duration: 1.8 }}
          />
        </motion.g>
      ))}
    </AnimatePresence>
  );
};
