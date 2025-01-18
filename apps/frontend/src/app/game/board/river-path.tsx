import { Fragment } from 'react';
import { riverData } from '../board-data/river';

export const RiverPath = () => {
  return (
    <>
      {riverData.map((river, index) => {
        const toNode = riverData.find((node) => node.id === river.id + 1);
        return (
          <Fragment key={index}>
            {toNode && (
              <path
                d={`M ${river.x} ${river.y} Q ${(river.x + toNode.x) / 2} ${(river.y + toNode.y) / 2} ${toNode.x} ${toNode.y}`}
                stroke="lightblue"
                strokeWidth="20"
                fill="none"
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
};
