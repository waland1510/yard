import React from 'react';

interface DoubleIconProps {
  available?: boolean;
}

export const DoubleIcon: React.FC<DoubleIconProps> = ({ available }) => {
  return (
    <svg
      width="100"
      height="50"
      version="1.1"
      viewBox="0 0 200 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0 -270.54)">
        <g>
          <rect
            x="1"
            y="271.54"
            width="198"
            height="98"
            rx="20"
            ry="20"
            fill={available ? '#f60' : '#000'}
            stroke="#000"
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke-width="2"
          />
          <path d="m2 320.54h44" fill="none" stroke="#fff" stroke-width="16" />
          <text
            x="100"
            y="348.54166"
            fill="#000000"
            fontFamily="sansSerif"
            fontSize="74.667px"
            font-weight="bold"
            letterSpacing="0px"
            stroke="#ffffff"
            stroke-width="4"
            textAnchor="middle"
            wordSpacing="0px"
          >
            <tspan x="100" y="348.54166">
              2×
            </tspan>
          </text>
        </g>
        <text
          x="100"
          y="348.54166"
          fill="#000000"
          fontFamily="sansSerif"
          fontSize="74.667px"
          font-weight="bold"
          letterSpacing="0px"
          textAnchor="middle"
          wordSpacing="0px"
        >
          <tspan x="100" y="348.54166">
            2×
          </tspan>
        </text>
        <path d="m154 320.54h44" fill="none" stroke="#fff" stroke-width="16" />
      </g>
    </svg>
  );
};
