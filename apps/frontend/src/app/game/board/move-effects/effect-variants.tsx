import { motion } from 'framer-motion';
import React from 'react';

export type EffectTransport =
  | 'taxi'
  | 'bus'
  | 'underground'
  | 'river'
  | 'secret'
  | 'double'
  | 'shadow';

export interface EffectProps {
  x: number;
  y: number;
  theme: string;
  cinematic?: boolean;
  delay?: number;
}

const CLASSIC: Record<EffectTransport, string> = {
  taxi: '#f5d000',
  bus: '#22c55e',
  underground: '#ef4444',
  river: '#0ea5e9',
  secret: '#4a4a4a',
  double: '#ff8800',
  shadow: '#2a2a2a',
};

const HP: Record<EffectTransport, string> = {
  taxi: '#e0c8ff',
  bus: '#a020f0',
  underground: '#3fc63f',
  river: '#ffd700',
  secret: '#1a1a2e',
  double: '#ffc040',
  shadow: '#3a3a5a',
};

const palette = (theme: string, t: EffectTransport): string =>
  (theme === 'harry-potter' ? HP : CLASSIC)[t];

// ── Taxi / Apparition ─────────────────────────────────────────────
const TaxiEffect: React.FC<EffectProps> = ({ x, y, theme, cinematic, delay = 0 }) => {
  const color = palette(theme, 'taxi');
  const isHp = theme === 'harry-potter';
  const size = cinematic ? 55 : 34;
  const duration = cinematic ? 1.2 : 0.55;

  if (isHp) {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <motion.circle
          r={0}
          fill="none"
          stroke={color}
          strokeWidth={3}
          initial={{ opacity: 1 }}
          animate={{ r: [0, size, size * 1.3], opacity: [1, 0.7, 0] }}
          transition={{ duration, delay, ease: 'easeOut' }}
        />
        <motion.circle
          r={0}
          fill={color}
          initial={{ opacity: 0 }}
          animate={{ r: [0, 9, 0], opacity: [0, 0.9, 0] }}
          transition={{ duration: duration * 0.55, delay }}
        />
      </g>
    );
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <motion.line
            key={a}
            x1={Math.cos(rad) * 10}
            y1={Math.sin(rad) * 10}
            x2={Math.cos(rad) * size}
            y2={Math.sin(rad) * size}
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration, delay, ease: 'easeOut' }}
          />
        );
      })}
    </g>
  );
};

// ── Bus / Knight Bus ──────────────────────────────────────────────
const BusEffect: React.FC<EffectProps> = ({ x, y, theme, cinematic, delay = 0 }) => {
  const color = palette(theme, 'bus');
  const isHp = theme === 'harry-potter';
  const duration = cinematic ? 1.2 : 0.55;

  if (isHp) {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <motion.path
          d="M -40 0 L -22 -16 L -6 12 L 10 -16 L 26 12 L 40 0"
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 1 }}
          animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
          transition={{ duration, delay }}
        />
      </g>
    );
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      {[0, 1, 2].map((i) => (
        <motion.rect
          key={i}
          y={-2 + (i - 1) * 6}
          height={3}
          rx={1.5}
          fill={color}
          initial={{ width: 0, x: -40, opacity: 0 }}
          animate={{ width: [0, 80, 80], x: [-40, -40, 40], opacity: [0, 1, 0] }}
          transition={{ duration, delay: delay + i * 0.04 }}
        />
      ))}
    </g>
  );
};

// ── Underground / Floo ────────────────────────────────────────────
const UndergroundEffect: React.FC<EffectProps> = ({ x, y, theme, cinematic, delay = 0 }) => {
  const color = palette(theme, 'underground');
  const isHp = theme === 'harry-potter';
  const size = cinematic ? 60 : 38;
  const duration = cinematic ? 1.2 : 0.6;

  if (isHp) {
    return (
      <motion.g
        transform={`translate(${x}, ${y})`}
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 360, opacity: [0, 1, 0] }}
        transition={{ duration, delay }}
      >
        {[0, 72, 144, 216, 288].map((a, i) => {
          const rad = (a * Math.PI) / 180;
          return (
            <motion.circle
              key={i}
              r={4}
              fill={color}
              initial={{ cx: Math.cos(rad) * 12, cy: Math.sin(rad) * 12, opacity: 1 }}
              animate={{
                cx: [Math.cos(rad) * 12, Math.cos(rad) * size],
                cy: [Math.sin(rad) * 12, Math.sin(rad) * size],
                opacity: [1, 0],
              }}
              transition={{ duration, delay }}
            />
          );
        })}
      </motion.g>
    );
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      {[0, 0.15].map((d, i) => (
        <motion.circle
          key={i}
          r={0}
          fill="none"
          stroke={color}
          strokeWidth={3}
          initial={{ opacity: 1 }}
          animate={{ r: [0, size, size * 1.25], opacity: [1, 0.6, 0] }}
          transition={{ duration, delay: delay + d, ease: 'easeOut' }}
        />
      ))}
    </g>
  );
};

// ── Secret / Invisibility Cloak ───────────────────────────────────
const SecretEffect: React.FC<EffectProps> = ({ x, y, theme, cinematic, delay = 0 }) => {
  const color = palette(theme, 'secret');
  const isHp = theme === 'harry-potter';
  const size = cinematic ? 55 : 36;
  const duration = cinematic ? 1.2 : 0.65;

  if (isHp) {
    return (
      <g transform={`translate(${x}, ${y})`}>
        {[0, 0.1, 0.2].map((d, i) => (
          <motion.circle
            key={i}
            r={0}
            fill={color}
            fillOpacity={0.35}
            initial={{ opacity: 0 }}
            animate={{ r: [0, size, size], opacity: [0, 0.8, 0] }}
            transition={{ duration, delay: delay + d }}
          />
        ))}
      </g>
    );
  }

  const puffs = [
    { dx: -9, dy: -7 },
    { dx: 9, dy: -7 },
    { dx: 0, dy: 9 },
    { dx: -11, dy: 6 },
    { dx: 11, dy: 6 },
  ];
  return (
    <g transform={`translate(${x}, ${y})`}>
      {puffs.map((p, i) => (
        <motion.circle
          key={i}
          fill={color}
          fillOpacity={0.5}
          initial={{ cx: p.dx, cy: p.dy, r: 6, opacity: 0.8 }}
          animate={{
            cx: p.dx * 1.5,
            cy: p.dy * 1.5 - 4,
            r: [6, 18],
            opacity: [0.8, 0],
          }}
          transition={{ duration, delay: delay + i * 0.04 }}
        />
      ))}
    </g>
  );
};

// ── Double / Time-Turner ──────────────────────────────────────────
const DoubleEffect: React.FC<EffectProps> = ({ x, y, theme, cinematic, delay = 0 }) => {
  const color = palette(theme, 'double');
  const isHp = theme === 'harry-potter';
  const duration = cinematic ? 1.4 : 0.75;

  if (isHp) {
    return (
      <motion.g
        transform={`translate(${x}, ${y})`}
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 720, opacity: [0, 1, 0] }}
        transition={{ duration, delay, ease: 'easeOut' }}
      >
        <circle r={22} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 3" />
        <circle r={12} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="2 2" />
      </motion.g>
    );
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      {[0, 0.3].map((d, i) => (
        <motion.circle
          key={i}
          r={0}
          fill="none"
          stroke={color}
          strokeWidth={4}
          initial={{ opacity: 1 }}
          animate={{ r: [0, 30, 40], opacity: [1, 0.5, 0] }}
          transition={{ duration: 0.55, delay: delay + d }}
        />
      ))}
    </g>
  );
};

// ── River / Portkey ───────────────────────────────────────────────
const RiverEffect: React.FC<EffectProps> = ({ x, y, theme, cinematic, delay = 0 }) => {
  const color = palette(theme, 'river');
  const isHp = theme === 'harry-potter';
  const size = cinematic ? 50 : 32;
  const duration = cinematic ? 1.3 : 0.75;

  if (isHp) {
    return (
      <motion.g
        transform={`translate(${x}, ${y})`}
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 540, opacity: [0, 1, 0] }}
        transition={{ duration, delay }}
      >
        <path
          d={`M 0 -${size} Q ${size * 0.7} -${size * 0.3}, 0 0 Q -${size * 0.7} ${size * 0.3}, 0 ${size}`}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </motion.g>
    );
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      {[0, 0.12, 0.24].map((d, i) => (
        <motion.circle
          key={i}
          r={0}
          fill="none"
          stroke={color}
          strokeWidth={2}
          initial={{ opacity: 1 }}
          animate={{ r: [0, size], opacity: [0.8, 0] }}
          transition={{ duration, delay: delay + d, ease: 'easeOut' }}
        />
      ))}
    </g>
  );
};

// ── Shadow (generic hidden-culprit hint) ──────────────────────────
const ShadowEffect: React.FC<EffectProps> = ({ x, y, theme, delay = 0 }) => {
  const color = palette(theme, 'shadow');
  return (
    <g transform={`translate(${x}, ${y})`}>
      <motion.circle
        r={0}
        fill={color}
        fillOpacity={0.45}
        initial={{ opacity: 0 }}
        animate={{ r: [0, 20, 26], opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.6, delay }}
      />
    </g>
  );
};

export const renderEffect = (
  transport: EffectTransport,
  props: EffectProps
): React.ReactNode => {
  switch (transport) {
    case 'taxi':
      return <TaxiEffect {...props} />;
    case 'bus':
      return <BusEffect {...props} />;
    case 'underground':
      return <UndergroundEffect {...props} />;
    case 'river':
      return <RiverEffect {...props} />;
    case 'secret':
      return <SecretEffect {...props} />;
    case 'double':
      return <DoubleEffect {...props} />;
    case 'shadow':
      return <ShadowEffect {...props} />;
  }
};
