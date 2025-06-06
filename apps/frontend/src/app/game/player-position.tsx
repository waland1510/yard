import { mapData } from "@yard/shared-utils";

export interface PlayerPositionProps {
  position: number;
  showPosition?: boolean;
}

 export const PlayerPosition = ({position, showPosition = true}: PlayerPositionProps) => {
    const node = mapData.nodes.find((node) => node.id === position);
    if (!node) {
      return null;
    }

    const hasBus = node.bus && node.bus.length > 0;
    const hasUnderground = node.underground && node.underground.length > 0;
    return (
      <svg width="52" height="52">
        <g>
          {hasBus && showPosition && (
            <circle
              cx={25}
              cy={25}
              r="21"
              fill="none"
              stroke="#080"
              strokeWidth="3"
            />
          )}
          {hasUnderground && showPosition && (
            <circle
              cx={25}
              cy={25}
              r="24"
              fill="none"
              stroke="#d00"
              strokeWidth="3"
            />
          )}
          <circle
            cx={25}
            cy={25}
            r="18"
            fill="white"
            stroke="black"
            strokeWidth="3"
            strokeDasharray={node.river ? '5 5' : 'none'}
          />
          <text
            x={25}
            y={30}
            textAnchor="middle"
            fontWeight="bold"
            fontSize="16"
            fill="black"
          >
            {showPosition ? position : '??'}
          </text>
        </g>
      </svg>
    );
  };
