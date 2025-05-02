import {
  Button,
  Flex,
  Text,
  VStack,
  Wrap,
  WrapItem
} from '@chakra-ui/react';
import { RoleType } from '@yard/shared-utils';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';
import { Drawer } from './drawer';
import { PlayerInfo } from './player-info';

interface LeftDrawerProps {
  isLeftOpen: boolean;
  onLeftClose: () => void;
  onRoleChange: (role: RoleType) => void;
}

export const LeftDrawer = ({
  isLeftOpen,
  onLeftClose,
  onRoleChange,
}: LeftDrawerProps) => {
  const { players } = useGameStore();
  const { currentRole } = useRunnerStore();
  const { t } = useTranslation();

  const header = (
    <Flex>
      <Button variant="outline" colorScheme="teal" onClick={onLeftClose}>
        {t('close')}
      </Button>
      <Flex direction="column" textAlign={'end'}>
        <Text fontSize="lg" fontWeight="bold" color={'teal.900'}>
          {t('playersInfo')}
        </Text>
        {currentRole !== 'culprit' && (
          <Text fontSize="sm" color="gray.900">
            {t('impersonate')}
          </Text>
        )}
      </Flex>
    </Flex>
  );

  const body = (
    <VStack spacing={4} align="stretch">
      {players && (
        <Wrap spacing={4} justify="center">
          {players
            .filter((player) => player.role !== currentRole)
            .map((p) => (
              <WrapItem
                key={p.id}
                w={'128px'}
                cursor={
                  currentRole !== 'culprit' && p.role !== 'culprit'
                    ? 'pointer'
                    : 'not-allowed'
                }
                onClick={
                  currentRole !== 'culprit' && p.role !== 'culprit'
                    ? () => onRoleChange(p.role)
                    : undefined
                }
              >
                <PlayerInfo
                  player={p}
                  currentRole={currentRole}
                  onRoleChange={onRoleChange}
                />
              </WrapItem>
            ))}
        </Wrap>
      )}
    </VStack>
  );

  return (
    <Drawer
      isOpen={isLeftOpen}
      onClose={onLeftClose}
      header={header}
      body={body}
      placement="left"
    />
  );
};
