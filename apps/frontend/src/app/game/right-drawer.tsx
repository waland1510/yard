import {
  Box,
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Text,
} from '@chakra-ui/react';
import { FiArrowRight } from 'react-icons/fi';
import { Moves } from './moves';

interface RightDrawerProps {
  isRightOpen: boolean;
  onRightClose: () => void;
  channel?: string;
}

export const RightDrawer = ({
  isRightOpen,
  onRightClose,
  channel,
}: RightDrawerProps) => (
  <Drawer isOpen={isRightOpen} placement="right" onClose={onRightClose}>
    <DrawerOverlay />
    <DrawerContent>
      <DrawerHeader>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Text>Moves History</Text>
          <Button onClick={onRightClose} rightIcon={<FiArrowRight />}>
            Close
          </Button>
        </Box>
      </DrawerHeader>
      <Moves />
    </DrawerContent>
  </Drawer>
);
