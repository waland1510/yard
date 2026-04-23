import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';

export const TurnBanner = () => {
  const { currentTurn, status } = useGameStore();
  const { currentRole } = useRunnerStore();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const prevTurn = useRef(currentTurn);

  useEffect(() => {
    if (status === 'finished') return;
    if (prevTurn.current === currentTurn) return;
    prevTurn.current = currentTurn;
    if (!currentRole || !currentTurn) return;
    if (currentRole !== currentTurn) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 1600);
    return () => window.clearTimeout(t);
  }, [currentTurn, currentRole, status]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="pointer-events-none fixed top-10 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-10 py-4"
          style={{
            background: 'linear-gradient(135deg, rgba(25,25,35,0.92), rgba(10,10,20,0.92))',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 40px rgba(100,200,150,0.35)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <p
            className="font-bold text-2xl tracking-[0.35em] uppercase text-white text-center"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}
          >
            {t('yourTurn')}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
