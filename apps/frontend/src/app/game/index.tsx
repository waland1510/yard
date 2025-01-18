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
  VStack,
} from '@chakra-ui/react';
import { RoleType } from '@yard/shared-utils';
import { useEffect } from 'react';
import { FiArrowLeft, FiMenu } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameByChannel, patchPlayer } from '../../api';
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
  const existingChannel = sessionStorage.getItem('channel');
  const { sendMessage } = useWebSocket(channel);
  const setChannel = useGameStore((state) => state.setChannel);
  const players = useGameStore((state) => state.players);
  const username = sessionStorage.getItem('username');
  const currentRole = useRunnerStore((state) => state.currentRole);
  const setCurrentRole = useRunnerStore((state) => state.setCurrentRole);
  const setCurrentPosition = useRunnerStore(
    (state) => state.setCurrentPosition
  );
  const currentTurn = useGameStore((state) => state.currentTurn);

  useEffect(() => {
    const checkGame = async () => {
      if (channel) {
        const [game] = await getGameByChannel(channel);

        if (game) {
          useGameStore.setState(game);
          if (!game.players.find((p) => p.username === username)) {
            sendMessage('joinGame', { channel, username, undefined });
          }
        }
      }
      if (existingChannel !== channel) {
        sessionStorage.setItem('channel', channel!);
        navigate(`/join/${channel}`);
      }
    };
    checkGame();
  }, []);

  useEffect(() => {
    setChannel(channel);

    // sendMessage('updateGameState', game);

    useGameStore.setState({ channel });
  }, [channel, setChannel]);

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
    setCurrentRole(role);
    const currentPlayer = players.find((p) => p.role === role);
    if (currentPlayer) {
      setCurrentPosition(currentPlayer.position);
      patchPlayer(currentPlayer.id, { username: username as string });
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
            {/* <Avatar size="xl" name="Detective 3" src="/path-to-avatar.png" />
              <VStack spacing={2}>
                <Text fontSize="lg" fontWeight="bold">
                  Detective 3
                </Text>
                <Badge colorScheme="yellow">Taxi: 10</Badge>
                <Badge colorScheme="green">Bus: 8</Badge>
                <Badge colorScheme="red">Metro: 4</Badge>
              </VStack>
              <Divider />
              <Text fontSize="sm" color="gray.500">
                Current Turn
              </Text>
              <Badge colorScheme="blue" p={2} rounded="lg">
                Your Turn
              </Badge> */}
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
          src="/images/logo.jpg"
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
          {/* <HStack spacing={4}>
            <Avatar size="sm" src="/path-to-avatar-1.png" />
            <Text fontSize="lg" fontWeight="bold">
              Val
            </Text>
            <Badge colorScheme="orange">Moves: 1</Badge>
          </HStack>
          <HStack spacing={4}>
            <Text fontSize="sm" color="gray.600">
              Current Position: <strong>30</strong>
            </Text>
            <Text fontSize="sm" color="gray.600">
              Current Type: <strong>Taxi</strong>
            </Text>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize="md" fontWeight="bold" color="gray.700">
              Game Status
            </Text>
          </HStack> */}
        </HStack>

        {/* Map Section */}
        <Box
          flex="1"
          margin="auto"
          overflow="scroll"
        >
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
          />
          <div className="text-sm">{currentTurn}</div>
        </div>
      </Box>
    </Flex>
  );
};
