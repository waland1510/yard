import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../stores/use-game-store';
import { themes } from '../themes';

const THEME_VISUALS: Record<string, { gradient: string; glow: string; border: string; label: string }> = {
  classic: {
    gradient: 'linear-gradient(140deg, #192535 0%, #0d1520 100%)',
    glow: 'rgba(60,100,170,0.55)',
    border: '#4a7aaa',
    label: 'LONDON · 1983',
  },
  'harry-potter': {
    gradient: 'linear-gradient(140deg, #2d0848 0%, #160325 100%)',
    glow: 'rgba(190,140,0,0.6)',
    border: '#c9922a',
    label: 'WIZARDING WORLD',
  },
};

export const ThemeSelector = () => {
  const { theme, setTheme } = useGameStore();

  return (
    <div className="flex gap-4 w-full mb-8">
      {Object.entries(themes).map(([key, themeData]) => {
        const isSelected = theme === key;
        const v = THEME_VISUALS[key] ?? THEME_VISUALS.classic;

        return (
          <motion.button
            key={key}
            onClick={() => setTheme(key)}
            className="relative flex-1 h-44 rounded-2xl overflow-hidden text-left focus:outline-none"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            animate={{
              boxShadow: isSelected
                ? `0 0 35px ${v.glow}, 0 8px 32px rgba(0,0,0,0.5)`
                : '0 4px 24px rgba(0,0,0,0.4)',
            }}
            transition={{ duration: 0.35 }}
          >
            <div className="absolute inset-0" style={{ background: v.gradient }} />

            {/* Subtle diagonal texture */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 8px)',
              }}
            />

            {/* Character image */}
            <motion.img
              src={themeData.characters.culprit.image}
              alt={themeData.characters.culprit.name}
              className="absolute bottom-0 right-3 h-40 object-contain pointer-events-none select-none"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))' }}
              whileHover={{ y: -4, scale: 1.05 }}
              transition={{ duration: 0.3 }}
            />

            {/* Label */}
            <div className="absolute top-4 left-4 z-10">
              <p className="text-xs font-semibold tracking-[0.25em] mb-1" style={{ color: v.border }}>
                {v.label}
              </p>
              <p className="text-white font-bold text-2xl leading-none">{themeData.name}</p>
            </div>

            {/* Selected border */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              animate={{
                boxShadow: isSelected ? `inset 0 0 0 2px ${v.border}` : 'inset 0 0 0 0px transparent',
              }}
              transition={{ duration: 0.3 }}
            />

            <AnimatePresence>
              {isSelected && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest z-10"
                  style={{ backgroundColor: v.border, color: '#000' }}
                >
                  SELECTED
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
};
