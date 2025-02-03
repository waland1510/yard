import { useState } from 'react';
import { useRunnerStore } from '../../../stores/use-runner-store';
import { Connections } from './connections';
import { Nodes } from './nodes';
import { RiverPath } from './river-path';
import { Box } from '@chakra-ui/react';

export const Board = () => {
  const isMagnifyEnabled = useRunnerStore((state) => state.isMagnifyEnabled);
  const [magnifyArea, setMagnifyArea] = useState({ x: 0, y: 0, radius: 100 });

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
      <svg
        width="1200"
        height="850"
        style={{ border: '2px solid gray', background: '#aaa' }}
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
          <Nodes />
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
      </svg>
    </Box>
  );
};
