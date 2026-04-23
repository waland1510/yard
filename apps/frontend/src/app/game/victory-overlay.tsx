import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/use-game-store';

const COLORS_CLASSIC = ['#f5d000', '#22c55e', '#ef4444', '#0ea5e9', '#ff8800'];
const COLORS_HP = ['#c9922a', '#a020f0', '#3fc63f', '#ffd700', '#e0c8ff'];

export const VictoryOverlay = () => {
  const { status, currentTurn, theme } = useGameStore();
  const { t } = useTranslation();
  const palette = theme === 'harry-potter' ? COLORS_HP : COLORS_CLASSIC;

  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: palette[i % palette.length],
        size: Math.random() * 8 + 4,
        duration: Math.random() * 2 + 2,
        delay: Math.random() * 0.5,
        rotate: Math.random() * 720 - 360,
        drift: (Math.random() - 0.5) * 200,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status]
  );

  return (
    <AnimatePresence>
      {status === 'finished' && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 100%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          />

          {pieces.map((p) => (
            <motion.span
              key={p.id}
              className="absolute block"
              style={{
                left: `${p.x}%`,
                top: '-5%',
                width: p.size,
                height: p.size * 1.4,
                backgroundColor: p.color,
                borderRadius: 2,
              }}
              initial={{ y: 0, x: 0, opacity: 1, rotate: 0 }}
              animate={{ y: '110vh', x: p.drift, rotate: p.rotate, opacity: [1, 1, 0.8, 0] }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: 'easeIn',
              }}
            />
          ))}

          <motion.div
            className="relative z-10 px-12 py-8 rounded-3xl text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(25,25,35,0.95), rgba(10,10,20,0.95))',
              border: '2px solid rgba(255,255,255,0.15)',
              boxShadow: '0 20px 80px rgba(0,0,0,0.7), 0 0 60px rgba(200,160,40,0.3)',
              backdropFilter: 'blur(12px)',
            }}
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.17, 0.88, 0.32, 1.28] }}
          >
            <p className="text-sm tracking-[0.4em] uppercase text-white/50 mb-2">
              {t('gameOver', { winner: '' }).replace(/[:!·]?\s*$/, '')}
            </p>
            <motion.p
              className="text-5xl font-bold text-white tracking-wider"
              style={{ textShadow: '0 4px 24px rgba(0,0,0,0.8)' }}
              initial={{ scale: 0.8 }}
              animate={{ scale: [0.8, 1.05, 1] }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {t(currentTurn).toUpperCase()}
            </motion.p>
            <p className="text-xs tracking-[0.3em] uppercase text-white/60 mt-3">
              {t('winner')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
