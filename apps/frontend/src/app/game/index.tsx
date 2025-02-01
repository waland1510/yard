import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  IconButton,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { RoleType } from '@yard/shared-utils';
import { useEffect } from 'react';
import { FiArrowLeft, FiMenu } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameByChannel, updatePlayer } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';
import useWebSocket from '../use-websocket';
import { Board } from './board';
import { Header } from './header';
import { Moves } from './moves';
import { Panel } from './panel';
import { PlayerInfo } from './player-info';

export const Game = () => {
  const navigate = useNavigate();
  const { id: channel } = useParams<{ id: string }>();
  const { sendMessage } = useWebSocket(channel);
  const setChannel = useGameStore((state) => state.setChannel);
  const players = useGameStore((state) => state.players);
  const username = localStorage.getItem('username');
  const currentRole = useRunnerStore((state) => state.currentRole);
  const setCurrentRole = useRunnerStore((state) => state.setCurrentRole);
  const setCurrentPosition = useRunnerStore(
    (state) => state.setCurrentPosition
  );
  const currentTurn = useGameStore((state) => state.currentTurn);
  const toast = useToast();

  useEffect(() => {
    const checkGame = async () => {
      if (channel) {
        try {
          const game = await getGameByChannel(channel);
          console.log('game', game);
          if (!game || game.status === 'finished') {
            localStorage.removeItem('channel');
            toast({
              title: 'Start New Game',
              description: 'This game has finished',
              status: 'success',
              duration: 9000,
              isClosable: true,
            });
            navigate('/');
            return;
          }

          if (game) {
            localStorage.setItem('channel', channel);
            setChannel(channel);
            useGameStore.setState(game);
            const currentPlayer = game.players.find(
              (p) => p.username === username
            );
            if (currentPlayer) {
              setCurrentRole(currentPlayer.role);
              sendMessage('joinGame', {
                channel,
                username,
                role: currentPlayer.role,
              });
            } else {
              navigate(`/join/${channel}`);
            }
          }
          if (!username) {
            navigate(`/join/${channel}`);
          }
        } catch (error) {
          console.log('error', error);
          toast({
            title: 'Error',
            description: 'Game not found',
            status: 'error',
            duration: 9000,
            isClosable: true,
          });
          navigate('/');
        }
      }
    };
    checkGame();
  }, []);

  const {
    isOpen: isLeftOpen,
    onOpen: onLeftOpen,
    onClose: onLeftClose,
  } = useDisclosure();
  const {
    isOpen: isRightOpen,
    onOpen: onRightOpen,
    onClose: onRightClose,
  } = useDisclosure();

  const onRoleChange = (role: RoleType) => {
    if (role === 'culprit' || currentRole === 'culprit') return;
    setCurrentRole(role);
    const currentPlayer = players.find((p) => p.role === role);
    if (currentPlayer) {
      setCurrentPosition(currentPlayer.position);
      updatePlayer(currentPlayer.id, { username: username as string });
    }

    sendMessage('updateGameState', role);
    sendMessage('impersonate', { role, username });
  };

  return (
    <Flex height="100vh" bg="#f7f9fc">
      {/* Left Sidebar Drawer */}
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

      {/* Left Sidebar Compact */}
      <Box
        w="120px"
        p={2}
        bg="white"
        boxShadow="xl"
        roundedRight="lg"
        display="flex"
        flexDirection="column"
        alignItems="center"
      >
        <IconButton
          icon={<FiMenu />}
          onClick={onLeftOpen}
          aria-label="Open Player Info"
        />
        <img
          className="w-20"
          src="/images/catch.png"
          alt="player"
          onClick={() => navigate('/')}
        />
        <Panel />
      </Box>

      {/* Main Content */}
      <Flex flex="1" direction="column">
        {/* Top Bar */}
        <HStack
          w="100%"
          p={1}
          bg="white"
          boxShadow="md"
          align="center"
          justify="space-between"
        >
          <Header />
        </HStack>

        {/* Map Section */}
        <Box flex="1" margin="auto" overflow="scroll">
          <Board channel={channel} />
        </Box>
      </Flex>

      {/* Right Sidebar Drawer */}
      <Drawer isOpen={isRightOpen} placement="right" onClose={onRightClose}>
        <DrawerOverlay />
        <DrawerContent>
          <Moves />
        </DrawerContent>
      </Drawer>

      {/* Right Sidebar Compact */}
      <Box
        w="120px"
        p={2}
        bg="white"
        boxShadow="xl"
        roundedLeft="lg"
        display="flex"
        flexDirection="column"
        alignItems="center"
      >
        <IconButton
          icon={<FiMenu />}
          onClick={onRightOpen}
          aria-label="Open Moves History"
        />
        <div className="flex flex-col items-center justify-between px-4 py-2 mb-5 rounded-lg bg-gray-200">
          <span className="text-2xl" role="img" aria-label="dice">
            🎲
          </span>
          <img
            className="w-10 h-12"
            src={`/images/${currentTurn}.png`}
            alt="player"
            onClick={() => onRoleChange(currentTurn)}
          />
          <div className="text-sm">{currentTurn}</div>
        </div>
      </Box>
    </Flex>
  );
};
