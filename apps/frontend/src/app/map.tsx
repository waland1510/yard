import React, { Fragment, useEffect, useState } from 'react';
import {mapData} from './grid_map';
import {connectionsData} from './connections';
import useWebSocket from './use-websocket';

const GameBoard = () => {
  const [nodes, setNodes] = useState<{ id: number; bus?: number[]; taxi: number[]; underground?: number[]; river?: number[]; x: number; y: number }[]>([]);
  const [connections, setConnections] = useState<{ from: number; to: number; types: string[] }[]>([]);

  const { messages, sendMessage } = useWebSocket();

  const handleSend = (id: number) => {
    sendMessage(id.toString());
  };

  useEffect(() => {
    setNodes(mapData.nodes);

    // // Generate connections from the nodes' `taxi`, `bus`, and `underground` arrays
    // const generatedConnections: { from: number; to: number; type: string }[] = [];
    // mapData.nodes.forEach(node => {
    //   if (node.taxi) {
    //     node.taxi.forEach(target => {
    //       generatedConnections.push({ from: node.id, to: target, type: 'taxi' });
    //     });
    //   }
    //   if (node.bus) {
    //     node.bus.forEach(target => {
    //       generatedConnections.push({ from: node.id, to: target, type: 'bus' });
    //     });
    //   }
    //   if (node.underground) {
    //     node.underground.forEach(target => {
    //       generatedConnections.push({ from: node.id, to: target, type: 'underground' });
    //     });
    //   }
    //     if (node.river) {
    //         node.river.forEach(target => {
    //         generatedConnections.push({ from: node.id, to: target, type: 'river' });
    //         });
    //     }
    // });

    setConnections(connectionsData);
  }, []);

  return (
    <svg width="1200" height="1000" style={{ border: '1px solid black' }}>
      {connections.map((conn, index) => {
        const fromNode = nodes.find(node => node.id === conn.from);
        const toNode = nodes.find(node => node.id === conn.to);
        return (
          <Fragment key={index}>
            {fromNode && toNode && conn.types.map((type, i) => (
              <line
                key={`${index}-${i}`}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={
                  type === 'taxi'
                    ? 'orange'
                    : type === 'bus'
                    ? 'green'
                    : type === 'river'
                    ? 'blue'
                    : 'red'
                }
                strokeWidth={
                  type === 'underground'
                    ? 7
                    : type === 'bus'
                    ? 5
                    : type === 'river'
                    ? 1
                    : 2
                }
              />
            ))}
          </Fragment>
        );
      })}
     {nodes.map(node => {
        const hasBus = node.bus && node.bus.length > 0;
        const hasUnderground = node.underground && node.underground.length > 0;

        return (
          <g key={node.id}>
            {/* Additional strokes for bus and underground */}
            {hasBus && (
              <circle
                cx={node.x}
                cy={node.y}
                r="12"
                fill="none"
                stroke="green"
                strokeWidth="2"
              />
            )}
            {hasUnderground && (
              <circle
                cx={node.x}
                cy={node.y}
                r="14"
                fill="none"
                stroke="red"
                strokeWidth="2"
              />
            )}
            {/* Main node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r="10"
              fill="white"
              stroke="black"
              strokeWidth="2"
              onClick={() => handleSend(node.id)}
            />
             <text
              x={node.x}
              y={node.y + 4} // Adjusted to vertically center the text
              textAnchor="middle"
              fontSize="10"
              fill="black"
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

export default GameBoard;
