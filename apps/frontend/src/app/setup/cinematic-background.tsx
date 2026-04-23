import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../stores/use-game-store';

const THEMES: Record<string, { from: string; to: string; glow: string; particle: string; flash: string }> = {
  default:        { from: '#08080f', to: '#0d0d1e', glow: 'rgba(50,50,120,0.22)',  particle: '#282868', flash: '#3a3a8a' },
  classic:        { from: '#0a0e14', to: '#121e2a', glow: 'rgba(40,70,130,0.22)',  particle: '#2a4060', flash: '#3a6090' },
  'harry-potter': { from: '#160520', to: '#0a0210', glow: 'rgba(180,120,0,0.18)',  particle: '#8a6010', flash: '#c9922a' },
};

export const CinematicBackground = () => {
  const { theme } = useGameStore();
  const s = THEMES[theme] ?? THEMES.default;
  const prevTheme = useRef(theme);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (theme !== prevTheme.current) {
      setFlash(true);
      prevTheme.current = theme;
      const id = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(id);
    }
  }, [theme]);

  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        dur: Math.random() * 5 + 4,
        delay: Math.random() * 4,
      })),
    []
  );

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden"
      animate={{ background: `linear-gradient(150deg, ${s.from} 0%, ${s.to} 100%)` }}
      transition={{ duration: 1.8, ease: 'easeInOut' }}
      style={{ zIndex: 0 }}
    >
      {/* Pulsing atmospheric glow */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            `radial-gradient(ellipse at 50% 65%, ${s.glow} 0%, transparent 60%)`,
            `radial-gradient(ellipse at 50% 58%, ${s.glow} 0%, transparent 55%)`,
            `radial-gradient(ellipse at 50% 65%, ${s.glow} 0%, transparent 60%)`,
          ],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Edge vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.85) 100%)' }}
      />

      {/* Floating particles */}
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute block rounded-full pointer-events-none"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, backgroundColor: s.particle }}
          animate={{ y: [0, -20, 0], opacity: [0.05, 0.28, 0.05] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Dramatic flash on theme change */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ backgroundColor: s.flash }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
