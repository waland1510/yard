import { AnimatePresence, motion } from 'framer-motion';

interface TicketCountProps {
  count: number;
}

export const TicketCount = ({ count }: TicketCountProps) => {
  const low = count > 0 && count <= 2;

  return (
    <div className="relative h-6 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count}
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className={`text-lg font-bold tabular-nums ${
            count === 0 ? 'text-red-600' : low ? 'text-orange-600' : 'text-slate-900'
          }`}
          style={
            low
              ? {
                  textShadow: '0 0 8px rgba(255,140,0,0.5)',
                  animation: 'ticket-low-pulse 1.2s ease-in-out infinite',
                }
              : undefined
          }
        >
          {count}
        </motion.span>
      </AnimatePresence>
      <style>{`
        @keyframes ticket-low-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
