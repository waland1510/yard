import {
  Box,
  Button,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  Text,
  useDisclosure,
  VStack
} from '@chakra-ui/react';
import { showCulpritAtMoves } from '@yard/shared-utils';
import { FiArrowRight } from 'react-icons/fi';
import { useGameStore } from '../../stores/use-game-store';

export const Moves = () => {
  const moves = useGameStore((state) => state.moves);
  const {
    isOpen: isRightOpen,
    onOpen: onRightOpen,
    onClose: onRightClose,
  } = useDisclosure();

  return (
    <>
      <DrawerHeader>Moves History</DrawerHeader>
      <DrawerBody>
        <VStack spacing={4} overflowY="auto" align="stretch">
          {moves?.filter(m => m.role === 'culprit').map((move, index) => (
            <Box
            key={index}
            p={3}
            bg="gray.100"
            rounded="md"
            _hover={{ bg: 'gray.200' }}
            >
              <Text>
                {index + 1}. {move.type} -{' '}
                {showCulpritAtMoves.includes(index + 1) ? move.position : '??'}
              </Text>
            </Box>
          ))}
        </VStack>
      </DrawerBody>
      <DrawerFooter>
        <Button onClick={onRightClose} rightIcon={<FiArrowRight />}>
          Close
        </Button>
      </DrawerFooter>
    </>
  );
};
