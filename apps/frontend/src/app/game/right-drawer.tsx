import { Box, Button, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { Drawer } from './drawer';
import { Moves } from './moves';

interface RightDrawerProps {
  isRightOpen: boolean;
  onRightClose: () => void;
}

export const RightDrawer = ({
  isRightOpen,
  onRightClose,
}: RightDrawerProps) => {
  const { t } = useTranslation();

  const header = (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Text fontSize="lg" fontWeight="bold" color={'teal.900'}>
        {t('moves')}
      </Text>
      <Button variant="outline" colorScheme="teal" onClick={onRightClose}>
        {t('close')}
      </Button>
    </Box>
  );

  const body = <Moves />;

  return (
    <Drawer
      isOpen={isRightOpen}
      onClose={onRightClose}
      header={header}
      body={body}
      placement="right"
    />
  );
};
