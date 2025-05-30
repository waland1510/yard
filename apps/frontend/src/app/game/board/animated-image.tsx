import React from 'react';
import { useSpring, animated, to } from 'react-spring';

const OFFSET = 14;
const ANIMATION_CONFIG = {
  movement: { tension: 60, friction: 14 },
  scale: { duration: 200 },
  reset: { duration: 200 }
} as const;

interface AnimatedImageProps {
  href: string;
  previousX: number;
  previousY: number;
  targetX: number;
  targetY: number;
  isCurrentPlayer: boolean;
  nodeId: number;
}

export const AnimatedImage: React.FC<AnimatedImageProps> = ({
  href,
  previousX,
  previousY,
  targetX,
  targetY,
  isCurrentPlayer,
  nodeId
}) => {
  const hasJustMoved = previousX !== targetX || previousY !== targetY;

  const springXY = useSpring({
    from: { x: previousX - OFFSET, y: previousY - OFFSET },
    to: { x: targetX - OFFSET, y: targetY - OFFSET },
    config: ANIMATION_CONFIG.movement,
    immediate: !hasJustMoved
  });

  const springScale = useSpring({
    from: { scale: 1 },
    to: async (next) => {
      if (hasJustMoved && isCurrentPlayer) {
        await next({ scale: 1.5 });
        await next({ scale: 1 });
      }
    },
    config: ANIMATION_CONFIG.scale,
    immediate: !hasJustMoved || !isCurrentPlayer
  });

  const { x, y } = springXY;
  const { scale } = springScale;

  return (
    <animated.image
      href={href}
      transform={to([x, y, scale], (x, y, s) => `translate(${x}, ${y}) scale(${s})`)}
      width="28"
      height="28"
    />
  );
};
