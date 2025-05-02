import {
  Drawer as ChakraDrawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from '@chakra-ui/react';
import { ReactNode } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  header: ReactNode;
  body: ReactNode;
  placement?: 'left' | 'right';
  bgColor?: string;
  color?: string;
}

export const Drawer = ({
  isOpen,
  onClose,
  header,
  body,
  placement = 'left',
  bgColor = '#8CC690',
  color = 'white',
}: DrawerProps) => {
  return (
    <ChakraDrawer isOpen={isOpen} placement={placement} onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent bg={bgColor} color={color} shadow="lg">
        <DrawerHeader borderBottomWidth="1px">{header}</DrawerHeader>
        <DrawerBody>{body}</DrawerBody>
      </DrawerContent>
    </ChakraDrawer>
  );
};
