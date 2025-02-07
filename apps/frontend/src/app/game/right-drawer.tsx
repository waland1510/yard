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
import { useTranslation } from "react-i18next";
interface RightDrawerProps {
  isRightOpen: boolean;
  onRightClose: () => void;
  channel?: string;
}

export const RightDrawer = ({
  isRightOpen,
  onRightClose,
  channel,
}: RightDrawerProps) => {
  const { t } = useTranslation();
  return (
  <Drawer isOpen={isRightOpen} placement="right" onClose={onRightClose}>
    <DrawerOverlay />
    <DrawerContent bg="#8CC690" color="white" shadow="lg">
      <DrawerHeader borderBottomWidth="1px">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Text fontSize="lg" fontWeight="bold" color={'teal.900'}>
            {t('moves')}
          </Text>
          <Button variant="outline" colorScheme="teal" onClick={onRightClose}>
            {t('close')}
          </Button>
        </Box>
      </DrawerHeader>
      <Moves />
    </DrawerContent>
  </Drawer>
)};
