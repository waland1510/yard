import {
  Box,
  DrawerBody,
  Text,
  VStack
} from '@chakra-ui/react';
import { showCulpritAtMoves } from '@yard/shared-utils';
import { useGameStore } from '../../stores/use-game-store';

export const Moves = () => {
  const moves = useGameStore((state) => state.moves);

  return (
    <DrawerBody>
        <VStack spacing={4} overflowY="auto" align="stretch">
          {moves
            ?.filter((m) => m.role === 'culprit')
            .map((move, index) => {
              console.log('move', move);
              return (
              <Box
                key={index}
                p={3}
                bg="gray.100"
                rounded="md"
                _hover={{ bg: 'gray.200' }}
              >
                <Text>
                  {index + 1}. {move.secret ? '🔒' : move.type} -{' '}
                  {showCulpritAtMoves.includes(index + 1)
                    ? move.position
                    : '??'}
                </Text>
              </Box>
            )})}
        </VStack>
      </DrawerBody>
  );
};
