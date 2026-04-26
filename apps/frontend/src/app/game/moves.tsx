import { Box, Flex, Text } from '@chakra-ui/react';
import { showCulpritAtMoves } from '@yard/shared-utils';
import { AnimatePresence, motion } from 'framer-motion';
import { FaEye } from 'react-icons/fa6';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/use-game-store';
import { themes } from '../themes';

const TRANSPORT_COLORS: Record<string, string> = {
  taxi: '#f5d000',
  bus: '#22c55e',
  underground: '#ef4444',
  river: '#0ea5e9',
  secret: '#a855f7',
};

export const Moves = () => {
  const allMoves = useGameStore((state) => state.moves);
  const theme = useGameStore((state) => state.theme);
  const moves = allMoves.filter((m) => m.role === 'culprit');
  const { t } = useTranslation();
  const selectedTheme = themes[theme] ?? themes['classic'];
  const currentRound = moves.length;

  return (
    <Box bg="#0f1420" p={3} borderRadius="md">
      <Flex direction="column" gap={2}>
        {Array.from({ length: 24 }).map((_, index) => {
          const round = index + 1;
          const move = moves[index];
          const isReveal = showCulpritAtMoves.includes(round);
          const isPast = round <= currentRound;
          const isCurrent = round === currentRound && !!move;
          const transportKey = move?.secret ? 'secret' : move?.type;
          const color = transportKey ? TRANSPORT_COLORS[transportKey] : '#444';
          const label = move
            ? move.secret
              ? t('secret').toUpperCase()
              : t(selectedTheme.transportation[move.type]).toUpperCase()
            : '···';
          const position =
            move && (move.secret || isReveal) ? move.position : '??';

          return (
            <motion.div
              key={round}
              initial={isCurrent ? { opacity: 0, x: 20, scale: 0.9 } : false}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{
                position: 'relative',
                padding: '10px 12px',
                borderRadius: 10,
                background: isPast
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))'
                  : 'rgba(255,255,255,0.02)',
                border: isReveal
                  ? `1px solid ${isPast ? color : 'rgba(239,68,68,0.4)'}`
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: isCurrent
                  ? `0 0 24px ${color}55, inset 0 0 12px ${color}22`
                  : 'none',
                overflow: 'hidden',
              }}
            >
              {isPast && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    background: color,
                  }}
                />
              )}

              <Flex align="center" gap={3} pl={2}>
                <Flex
                  w={7}
                  h={7}
                  align="center"
                  justify="center"
                  borderRadius="full"
                  fontSize="xs"
                  fontWeight="bold"
                  bg={isPast ? color : 'rgba(255,255,255,0.06)'}
                  color={isPast ? '#000' : 'rgba(255,255,255,0.5)'}
                  flexShrink={0}
                >
                  {round}
                </Flex>

                <Flex direction="column" flex={1} minW={0}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    letterSpacing="0.08em"
                    color={isPast ? 'white' : 'rgba(255,255,255,0.4)'}
                    noOfLines={1}
                  >
                    {label}
                  </Text>
                  <Flex align="center" gap={2} mt={0.5}>
                    {isReveal && (
                      <motion.span
                        animate={isCurrent ? { opacity: [0.4, 1, 0.4] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{ display: 'flex', alignItems: 'center' }}
                      >
                        <FaEye
                          color={isPast ? color : '#ef4444'}
                          size={12}
                        />
                      </motion.span>
                    )}
                    <Text
                      fontSize="xs"
                      color={
                        isPast && position !== '??'
                          ? 'rgba(255,255,255,0.85)'
                          : 'rgba(255,255,255,0.35)'
                      }
                      fontFamily="mono"
                    >
                      #{position}
                    </Text>
                  </Flex>
                </Flex>
              </Flex>

              <AnimatePresence>
                {isCurrent && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.2, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: color,
                      borderRadius: 10,
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </Flex>
    </Box>
  );
};
