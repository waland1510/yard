import React, { useEffect, useState } from 'react';
import { useSpring, animated } from 'react-spring';

interface AnimatedImageProps {
  href: string;
  previousX?: number;
  previousY?: number;
  targetX: number;
  targetY: number;
}

export const AnimatedImage: React.FC<AnimatedImageProps> = ({
  href,
  previousX,
  previousY,
  targetX,
  targetY,
}) => {
  if (!previousX || !previousY) {
    return null;
  }
  const springProps = useSpring({
    from: { x: previousX - 14, y: previousY - 14 },
    to: { x: targetX - 14, y: targetY - 14 },
    config: { tension: 60, friction: 14 } 
  });

  return (
    <>
      <defs>
        <clipPath id={`clip-circle-${targetX}-${targetY}`}>
          <circle cx={targetX} cy={targetY} r="14" />
        </clipPath>
      </defs>
      <animated.image
        href={href}
        x={springProps.x}
        y={springProps.y}
        width="28"
        height="28"
      />
    </>
  );
};
