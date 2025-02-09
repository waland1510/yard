import React from 'react';
import { useTranslation } from "react-i18next";
interface UndergroundIconProps {
  available?: boolean;
}

export const UndergroundIcon: React.FC<UndergroundIconProps> = ({ available }) => {
  const { t } = useTranslation();
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
            fill={available ? "#d00" : "gray"}
            stroke="gray"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <circle
            cx="100"
            cy="320.54"
            r="35"
            fill="none"
            stroke="#fff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="16"
          />
          <path
            d="m40 320.54h120"
            fill="none"
            stroke="#fff"
            strokeWidth="16"
          />
        </g>
        <text
          x="100"
          y="326.54147"
          fill="gray000"
          fontFamily="sansSerif"
          fontSize="16px"
          letterSpacing="-1px"
          textAnchor="middle"
          wordSpacing="0px"
        >
          <tspan x="99.5" y="326.54147">
            {t("underground").toUpperCase()}
          </tspan>
        </text>
      </g>
    </svg>
  );
};
