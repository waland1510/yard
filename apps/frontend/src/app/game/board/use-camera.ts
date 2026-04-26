import { useEffect, useRef } from 'react';
import { useSpring } from 'react-spring';
import { mapData } from '@yard/shared-utils';
import { useGameStore } from '../../../stores/use-game-store';

const SVG_W = 1200;
const SVG_H = 850;
const ZOOM = 1.5;
const ZOOM_TTL = 2500;

export const useCamera = () => {
  const currentTurn = useGameStore((s) => s.currentTurn);
  const players = useGameStore((s) => s.players);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const [spring, api] = useSpring(() => ({
    x: 0,
    y: 0,
    w: SVG_W,
    h: SVG_H,
    config: { tension: 80, friction: 22 },
  }));

  useEffect(() => {
    if (currentTurn === 'culprit') {
      clearTimeout(timerRef.current);
      api.start({ x: 0, y: 0, w: SVG_W, h: SVG_H });
      return;
    }

    const player = players.find((p) => p.role === currentTurn);
    if (!player?.position) return;

    const node = mapData.nodes.find((n) => n.id === player.position);
    if (!node) return;

    const vw = SVG_W / ZOOM;
    const vh = SVG_H / ZOOM;
    api.start({
      x: Math.max(0, Math.min(node.x - vw / 2, SVG_W - vw)),
      y: Math.max(0, Math.min(node.y - vh / 2, SVG_H - vh)),
      w: vw,
      h: vh,
    });

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      api.start({ x: 0, y: 0, w: SVG_W, h: SVG_H });
    }, ZOOM_TTL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn]);

  return spring;
};
