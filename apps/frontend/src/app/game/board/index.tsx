import { useState } from 'react';
import { animated, to } from 'react-spring';
import { motion } from 'framer-motion';
import { useRunnerStore } from '../../../stores/use-runner-store';
import { Connections } from './connections';
import { MoveEffects } from './move-effects';
import { RevealSpotlight } from './move-effects/reveal-spotlight';
import { MovementTrail } from './movement-trail';
import { Nodes } from './nodes';
import { RiverPath } from './river-path';
import { useCamera } from './use-camera';
import { useScreenShake } from './use-screen-shake';
import { Box, Center, Text } from '@chakra-ui/react';
import { useGameStore } from '../../../stores/use-game-store';
import { useTranslation } from 'react-i18next';

export const Board = () => {
  const { isMagnifyEnabled, currentRole } = useRunnerStore();
  const { t } = useTranslation();
  const { status, currentTurn } = useGameStore();
  const isYourTurn = currentRole === currentTurn;
  const [magnifyArea, setMagnifyArea] = useState({ x: 0, y: 0, radius: 100 });

  const cameraSpring = useCamera();
  const isShaking = useScreenShake();

  const viewBox = to(
    [cameraSpring.x, cameraSpring.y, cameraSpring.w, cameraSpring.h],
    (x, y, w, h) => `${x} ${y} ${w} ${h}`
  );

  const handleMouseMove = (event: {
    currentTarget: { getBoundingClientRect: () => DOMRect };
    clientX: number;
    clientY: number;
  }) => {
    if (isMagnifyEnabled) {
      const svgRect = event.currentTarget.getBoundingClientRect();
      setMagnifyArea({
        x: event.clientX - svgRect.left,
        y: event.clientY - svgRect.top,
        radius: 150,
      });
    }
  };

  return (
    <Box>
      {status === 'finished' && (
        <Center
          position="absolute"
          top="0"
          left="0"
          width="100%"
          height="100%"
          bg="rgba(0, 0, 0, 0.5)"
        >
          <Text fontSize="4xl" color="white">
            {t('gameOver', { winner: t(currentTurn) })}
          </Text>
        </Center>
      )}
      <motion.div
        animate={
          isShaking
            ? { x: [0, -10, 10, -8, 8, -4, 4, 0], y: [0, -4, 4, -3, 3, 0] }
            : { x: 0, y: 0 }
        }
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <animated.svg
          width="1200"
          height="850"
          viewBox={viewBox}
          style={{
            border: '2px solid gray',
            background: '#aaa',
            opacity: status === 'finished' ? 0.3 : isYourTurn ? 1 : 0.88,
            transition: 'opacity 0.4s ease',
            boxShadow: isYourTurn
              ? '0 0 40px rgba(120,200,160,0.35)'
              : 'none',
          }}
          onMouseMove={handleMouseMove}
        >
          {isMagnifyEnabled && (
            <defs>
              <mask id="magnify-mask">
                <rect width="100%" height="100%" fill="white" />
                <circle
                  cx={magnifyArea.x}
                  cy={magnifyArea.y}
                  r="300"
                />
              </mask>
            </defs>
          )}

          <g mask="url(#magnify-mask)">
            <RiverPath />
            <Connections />
            <MovementTrail />
            <Nodes />
            <MoveEffects />
            <RevealSpotlight />
          </g>
          <defs>
            {isMagnifyEnabled && (
              <clipPath id="magnify-clip">
                <circle
                  cx={magnifyArea.x}
                  cy={magnifyArea.y}
                  r={magnifyArea.radius}
                />
              </clipPath>
            )}
          </defs>
          {isMagnifyEnabled && (
            <g
              style={{
                transform: `scale(2)`,
                transformOrigin: `${magnifyArea.x}px ${magnifyArea.y}px`,
                clipPath: 'url(#magnify-clip)',
              }}
            >
              <RiverPath />
              <Connections />
              <Nodes />
            </g>
          )}
        </animated.svg>
      </motion.div>
    </Box>
  );
};
