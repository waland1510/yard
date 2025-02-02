import { Fragment } from 'react';
import { connectionsData } from '../board-data/connections-data';
import { mapData } from '../board-data/grid_map';

export const Connections = () => {
  return (
    <>
      {connectionsData.map((conn, index) => {
        const fromNode = mapData.nodes.find((node) => node.id === conn.from);
        const toNode = mapData.nodes.find((node) => node.id === conn.to);
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
                      ? '#dd0'
                      : type === 'bus'
                      ? '#080'
                      : type === 'river'
                      ? '#060606'
                      : '#d00'
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
    </>
  );
};
