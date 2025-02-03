import React, { useMemo } from 'react';
import { useSpring, animated, to } from 'react-spring';

const OFFSET = 14;
const ANIMATION_CONFIG = {
  movement: { tension: 60, friction: 14 },
  scale: { duration: 1000 },
  reset: { duration: 500 }
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

  const position = useMemo(() => ({
    from: { x: previousX - OFFSET, y: previousY - OFFSET },
    to: { x: targetX - OFFSET, y: targetY - OFFSET }
  }), [previousX, previousY, targetX, targetY]);

  const springProps = useSpring({
    ...position,
    config: ANIMATION_CONFIG.movement
  });

  const combinedSpring = useSpring({
    from: { x: targetX - OFFSET, y: targetY - OFFSET, scale: 1 },
    to: async (next) => {
      await next({
        x: targetX - OFFSET,
        y: targetY - OFFSET,
        scale: 1.5,
        config: ANIMATION_CONFIG.scale,
      });
      await next({
        scale: 1,
        config: ANIMATION_CONFIG.reset
      });
    },
    reset: true,
  });

  const transform = useMemo(() =>
    to(
      [combinedSpring.x, combinedSpring.y, combinedSpring.scale],
      (x, y, scale) => `translate(${x}, ${y}) scale(${scale})`
    ),
    [combinedSpring.x, combinedSpring.y, combinedSpring.scale]
  );

  if (isCurrentPlayer) {
    return (
      <animated.image
        href={href}
        transform={transform}
        width="28"
        height="28"
      />
    );
  }

  return (
    <animated.image
      href={href}
      x={springProps.x}
      y={springProps.y}
      width="28"
      height="28"
      clipPath={`url(#clip-circle-${nodeId})`}
    />
  );
};
