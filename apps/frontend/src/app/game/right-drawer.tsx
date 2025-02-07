import {
  Box,
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Text,
} from '@chakra-ui/react';
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
    <DrawerContent bg="#8CC690" color="white" shadow="lg">
      <DrawerHeader borderBottomWidth="1px">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Text fontSize="lg" fontWeight="bold" color={'teal.900'}>
            Moves
          </Text>
          <Button variant="outline" colorScheme="teal" onClick={onRightClose}>
            Close
          </Button>
        </Box>
      </DrawerHeader>
      <Moves />
    </DrawerContent>
  </Drawer>
);
