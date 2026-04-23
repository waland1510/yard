import { Move, showCulpritAtMoves } from '@yard/shared-utils';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../../../stores/use-game-store';
import { useNodesStore } from '../../../../stores/use-nodes-store';
import { useRunnerStore } from '../../../../stores/use-runner-store';
import { EffectTransport } from './effect-variants';
import { playSfx, SfxKey } from './sfx';

export interface ActiveEffect {
  id: string;
  transport: EffectTransport;
  theme: string;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  cinematic: boolean;
}

export const useMoveEffects = (): ActiveEffect[] => {
  const [effects, setEffects] = useState<ActiveEffect[]>([]);
  const moves = useGameStore((s) => s.moves);
  const players = useGameStore((s) => s.players);
  const theme = useGameStore((s) => s.theme);
  const status = useGameStore((s) => s.status);
  const currentRole = useRunnerStore((s) => s.currentRole);
  const nodes = useNodesStore((s) => s.nodes);

  const processedCount = useRef(moves.length);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (moves.length <= processedCount.current) {
      processedCount.current = moves.length;
      return;
    }
    const startIdx = processedCount.current;
    const newMoves = moves.slice(startIdx);
    processedCount.current = moves.length;

    newMoves.forEach((move: Move, i) => {
      const player = players.find((p) => p.role === move.role);
      if (!player) return;

      const destNode = nodes.find((n) => n.id === Number(move.position));
      const origNode = nodes.find((n) => n.id === Number(player.previousPosition));
      if (!destNode || !origNode) return;

      const isCulprit = move.role === 'culprit';
      const culpritMoveNumber = moves
        .slice(0, startIdx + i + 1)
        .filter((m) => m.role === 'culprit').length;
      const isReveal = isCulprit && showCulpritAtMoves.includes(culpritMoveNumber);
      const viewerIsCulprit = currentRole === 'culprit';
      const hideFromViewer = isCulprit && !isReveal && !viewerIsCulprit;

      let transport: EffectTransport;
      if (hideFromViewer) {
        transport = 'shadow';
      } else if (move.secret) {
        transport = 'secret';
      } else if (move.double && isCulprit) {
        transport = 'double';
      } else {
        transport = move.type as EffectTransport;
      }

      const cinematic =
        isReveal ||
        (isCulprit && (!!move.secret || !!move.double)) ||
        status === 'finished';
      const ttl = cinematic ? 1900 : 900;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const originX = hideFromViewer ? destNode.x : origNode.x;
      const originY = hideFromViewer ? destNode.y : origNode.y;

      const fx: ActiveEffect = {
        id,
        transport,
        theme,
        originX,
        originY,
        targetX: destNode.x,
        targetY: destNode.y,
        cinematic,
      };

      setEffects((prev) => [...prev, fx]);

      if (!hideFromViewer) playSfx(transport as SfxKey);
      if (isReveal) playSfx('reveal');
      if (status === 'finished') playSfx('capture');

      const timeout = setTimeout(() => {
        setEffects((prev) => prev.filter((e) => e.id !== id));
        timeoutsRef.current = timeoutsRef.current.filter((t) => t !== timeout);
      }, ttl);
      timeoutsRef.current.push(timeout);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves.length]);

  return effects;
};
