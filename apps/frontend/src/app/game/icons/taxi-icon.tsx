import React from 'react';

interface TaxiIconProps {
  available?: boolean;
}

export const TaxiIcon: React.FC<TaxiIconProps> = ({ available }) => {
  return (
    <svg
      width="100"
      height="50"
      version="1.1"
      viewBox="0 0 200 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0 -270.54)">
        <rect
          x="1"
          y="271.54"
          width="198"
          height="98"
          rx="20"
          ry="20"
          fill="#dd0"
          stroke="#000"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <text
          x="100"
          y="348.54166"
          fill="#000000"
          fontFamily="sansSerif"
          fontSize="74.667px"
          letterSpacing="0px"
          stroke="#ffffff"
          strokeWidth="4"
          textAnchor="middle"
          wordSpacing="0px"
        >
          <tspan x="100" y="348.54166">
            TAXI
          </tspan>
        </text>
        <text
          x="100"
          y="348.54166"
          fill="#000000"
          fontFamily="sansSerif"
          fontSize="74.667px"
          letterSpacing="0px"
          textAnchor="middle"
          wordSpacing="0px"
        >
          <tspan x="100" y="348.54166">
            TAXI
          </tspan>
        </text>
        <rect
          x="1"
          y="271.54"
          width="198"
          height="98"
          rx="20"
          ry="20"
          fill={available ? "#dd0" : "#e6e6e6"}
          stroke="#000"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <text
          x="100"
          y="348.54166"
          fill="#000000"
          fontFamily="sansSerif"
          fontSize="74.667px"
          letterSpacing="0px"
          stroke="#ffffff"
          strokeWidth="4"
          textAnchor="middle"
          wordSpacing="0px"
        >
          <tspan x="100" y="348.54166">
            TAXI
          </tspan>
        </text>
        <text
          x="100"
          y="348.54166"
          fill="#000000"
          fontFamily="sansSerif"
          fontSize="74.667px"
          letterSpacing="0px"
          textAnchor="middle"
          wordSpacing="0px"
        >
          <tspan x="100" y="348.54166">
            TAXI
          </tspan>
        </text>
      </g>
    </svg>
  );
};
