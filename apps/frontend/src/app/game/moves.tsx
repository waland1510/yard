import { Box, DrawerBody, Text, VStack } from '@chakra-ui/react';
import { showCulpritAtMoves } from '@yard/shared-utils';
import { useGameStore } from '../../stores/use-game-store';
import { useTranslation } from "react-i18next";

export const Moves = () => {
  const moves = useGameStore((state) => state.moves).filter((m) => m.role === 'culprit');
  const { t } = useTranslation();

  return (
    <DrawerBody bg="#8CC690" color="white" overflowY="auto" maxH="100%">
    <VStack spacing={4} align="stretch">
      {Array.from({ length: 24 }).map((_, index) => {
        const move = moves?.find((m, i) => i === index);
        const isSpecialMove = showCulpritAtMoves.includes(index + 1 );
        return (
          <Box
            key={index}
            p={4}
            bg={move ? "#ACD8AF" : "#2A3C2C"}
            shadow="md"
            rounded="md"
            color={move ? "black" : "white"}
            borderLeft={isSpecialMove ? "4px solid red" : "none"}
          >
            <Text fontSize="md" fontWeight="medium">
              {index + 1}. {move ? (move.secret ? '🔒' : t(move.type).toUpperCase()) : '...'} -{' '}
              {move && showCulpritAtMoves.includes(index + 1)
                ? move.position
                : '??'}
            </Text>
          </Box>
        );
      })}
    </VStack>
  </DrawerBody>
  );
};
