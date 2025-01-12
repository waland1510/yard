import React, { Fragment, useEffect, useState } from 'react';
import { mapData } from './grid_map';
import { connectionsData } from './connections';
import useWebSocket from './use-websocket';
import { useRunnerStore } from '../stores/use-runner-store';
import { usePlayersSubscription } from '../hooks/use-players-subscription';
import { usePlayerSubscription } from '../hooks/use-player-subscription';
import { useGameStore } from '../stores/use-game-store';
import { MapNode } from '../stores/use-nodes-store';
import { riverData } from './river';

export const Board = ({ channel }: { channel: string }) => {
  const players = usePlayersSubscription();

  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [connections, setConnections] = useState<
    { from: number; to: number; types: string[] }[]
  >([]);

  const currentPosition = usePlayerSubscription().currentPosition;
  const currentType = useRunnerStore((state) => state.currentType);
  const currentRole = useRunnerStore((state) => state.currentRole);
  const updateMoves = useGameStore((state) => state.updateMoves);
  const setCurrentPosition = useRunnerStore(
    (state) => state.setCurrentPosition
  );

  const availableMoves =
    nodes.find((node) => node.id === currentPosition)?.[
      currentType as 'taxi' | 'bus' | 'underground' | 'river'
    ] || [];
  // const existingChannel = useGameStore((state) => state.channel);
  // console.log('existingChannel', existingChannel);

  const { sendMessage } = useWebSocket(channel);

  const handleSend = (id: number) => {
    if (currentRole === 'culprit') {
      if (updateMoves) {
        updateMoves({
          type: currentType,
          position: id,
          isSecret: false,
          isDouble: false,
        });
      }
    }
    sendMessage('makeMove', { role: currentRole, target: id.toString() });
    setCurrentPosition(id);
  };

  useEffect(() => {
    setNodes(mapData.nodes);
    setConnections(connectionsData);
    // sendMessage('joinGame', channel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg
      width="1200"
      height="850"
      style={{ border: '2px solid gray', background: '#f0f0f0' }}
    >
      {riverData.map((river, index) => {
        const toNode = riverData.find((node) => node.id === river.id + 1);
        return (
          <Fragment key={index}>
            {toNode && (
              <path
                d={`M ${river.x} ${river.y} Q ${(river.x + toNode?.x) / 2} ${
                  (river.y + toNode.y) / 2
                } ${toNode.x} ${toNode.y}`}
                stroke="lightblue"
                strokeWidth="20"
                fill="none"
              />
            )}
          </Fragment>
        );
      })}
      {connections.map((conn, index) => {
        const fromNode = nodes.find((node) => node.id === conn.from);
        const toNode = nodes.find((node) => node.id === conn.to);
        return (
          <Fragment key={index}>
            {fromNode &&
              toNode &&
              conn.types.map((type, i) => (
                <line
                  key={`${index}-${i}`}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={
                    type === 'taxi'
                      ? 'yellow'
                      : type === 'bus'
                      ? 'green'
                      : type === 'river'
                      ? '#060606'
                      : 'red'
                  }
                  strokeWidth={
                    type === 'underground'
                      ? 15
                      : type === 'bus'
                      ? 10
                      : type === 'river'
                      ? 10
                      : 5
                  }
                  strokeDasharray={
                    type === 'underground'
                      ? '7 7'
                      : type === 'river'
                      ? '25 15'
                      : 'none'
                  }
                />
              ))}
          </Fragment>
        );
      })}
      {nodes.map((node) => {
        const hasBus = node.bus && node.bus.length > 0;
        const hasUnderground = node.underground && node.underground.length > 0;
        if (node.id < 0) return null;
        const role = players.find((p) => p.position === node.id)?.role;
        return (
          <g key={node.id}>
            {/* Additional strokes for bus and underground */}
            {hasBus && (
              <circle
                cx={node.x}
                cy={node.y}
                r="18"
                fill="none"
                stroke="#0db708"
                strokeWidth="4"
              />
            )}
            {hasUnderground && (
              <circle
                cx={node.x}
                cy={node.y}
                r="22"
                fill="none"
                stroke="#ed0013"
                strokeWidth="4"
              />
            )}
            {/* Main node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r="14"
              fill="white"
              stroke="black"
              strokeWidth="4"
              onClick={() => handleSend(node.id)}
              strokeDasharray={node.river ? '5 5' : 'none'}
            />
            {/* Image fitting in the circle */}
            <defs>
              <clipPath id={`clip-circle-${node.id}`}>
                <circle cx={node.x} cy={node.y} r="14" />
              </clipPath>
            </defs>
            {role && (
              <image
                href={`/images/${role}.png`}
                x={node.x - 14}
                y={node.y - 14}
                width="28"
                height="28"
                clipPath={`url(#clip-circle-${node.id})`}
              />
            )}
            {/* Text on top of the circle and image */}
            <text
              x={node.x}
              y={node.y + 5}
              textAnchor="middle"
              fontWeight={role ? 'bold' : 'normal'}
              fontSize={currentPosition === node.id ? '16' : '14'}
              fill={
                role
                  ? 'transparent'
                  : currentPosition === node.id
                  ? 'red'
                  : availableMoves?.includes(node.id)
                  ? 'orange'
                  : 'black'
              }
              onClick={() => handleSend(node.id)}
            >
              {node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
