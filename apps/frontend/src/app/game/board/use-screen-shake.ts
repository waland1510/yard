import { useEffect, useState } from 'react';
import { showCulpritAtMoves } from '@yard/shared-utils';
import { useGameStore } from '../../../stores/use-game-store';

const SHAKE_TTL = 500;

export const useScreenShake = () => {
  const [isShaking, setIsShaking] = useState(false);
  const moves = useGameStore((s) => s.moves);
  const status = useGameStore((s) => s.status);

  useEffect(() => {
    if (status === 'finished') {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), SHAKE_TTL);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    if (moves.length === 0) return;

    const lastMove = moves[moves.length - 1];
    if (lastMove.role !== 'culprit') return;

    const culpritMoveCount = moves.filter((m) => m.role === 'culprit').length;
    if (!showCulpritAtMoves.includes(culpritMoveCount)) return;

    setIsShaking(true);
    const timer = setTimeout(() => setIsShaking(false), SHAKE_TTL);
    return () => clearTimeout(timer);
  }, [moves.length]);

  return isShaking;
};
