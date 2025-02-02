import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Text,
  VStack
} from '@chakra-ui/react';
import { RoleType } from '@yard/shared-utils';
import { FiArrowLeft } from 'react-icons/fi';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';
import { PlayerInfo } from './player-info';

interface LeftDrawerProps {
  isLeftOpen: boolean;
  onLeftClose: () => void;
  channel?: string;
  onRoleChange: (role: RoleType) => void;
}

export const LeftDrawer = ({ isLeftOpen, onLeftClose, channel, onRoleChange }: LeftDrawerProps) => {
  const { players } = useGameStore();
  const { currentRole } = useRunnerStore();
  return (
    <Drawer isOpen={isLeftOpen} placement="left" onClose={onLeftClose}>
      <DrawerOverlay />
      <DrawerContent>
        <DrawerHeader>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Button onClick={onLeftClose} leftIcon={<FiArrowLeft />}>
              Close
            </Button>
            <Text>Players Info</Text>
          </Box>
        </DrawerHeader>
        <DrawerBody>
          <VStack spacing={6} align="stretch">
            {players && (
              <>
                <div className="flex gap-2 items-end">
                  {players
                    .filter((player) => player.role !== currentRole)
                    .slice(0, 3)
                    .map((p) => (
                      <PlayerInfo
                        key={p.id}
                        player={p}
                        currentRole={currentRole}
                        onRoleChange={onRoleChange}
                      />
                    ))}
                </div>
                <div className="flex gap-2 items-end">
                  {players
                    .filter((player) => player.role !== currentRole)
                    .slice(3)
                    .map((p) => (
                      <PlayerInfo
                        key={p.id}
                        player={p}
                        currentRole={currentRole}
                        onRoleChange={onRoleChange}
                      />
                    ))}
                </div>
              </>
            )}
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};
