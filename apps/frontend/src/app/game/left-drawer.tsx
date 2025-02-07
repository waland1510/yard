import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { RoleType } from '@yard/shared-utils';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';
import { PlayerInfo } from './player-info';

interface LeftDrawerProps {
  isLeftOpen: boolean;
  onLeftClose: () => void;
  channel?: string;
  onRoleChange: (role: RoleType) => void;
}

export const LeftDrawer = ({
  isLeftOpen,
  onLeftClose,
  channel,
  onRoleChange,
}: LeftDrawerProps) => {
  const { players } = useGameStore();
  const { currentRole } = useRunnerStore();

  return (
    <Drawer isOpen={isLeftOpen} placement="left" onClose={onLeftClose}>
      <DrawerOverlay />
      <DrawerContent bg="#8CC690" color="white" shadow="lg">
        <DrawerHeader borderBottomWidth="1px">
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Button variant="outline" colorScheme="teal" onClick={onLeftClose}>
              Close
            </Button>
            <Flex alignItems="center" direction="column">
              <Text fontSize="lg" fontWeight="bold" color={'teal.900'}>
                Players Info
              </Text>
              {currentRole !== 'culprit' && (
                <Text fontSize="sm" color="gray.900">
                  Click to impersonate
                </Text>
              )}
            </Flex>
          </Box>
        </DrawerHeader>

        <DrawerBody>
          <VStack spacing={4} align="stretch">
            {players && (
              <Wrap spacing={4} justify="center">
                {players
                  .filter((player) => player.role !== currentRole)
                  .map((p) => (
                    <WrapItem
                      key={p.id}
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
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};
