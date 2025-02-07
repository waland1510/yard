import {
  Box,
  Button,
  Flex,
  VStack,
  Heading,
  Divider,
  useDisclosure,
  useToast,
  Text,
} from '@chakra-ui/react';
import { RoleType } from '@yard/shared-utils';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameByChannel, updatePlayer } from '../../api';
import { useGameStore } from '../../stores/use-game-store';
import { useRunnerStore } from '../../stores/use-runner-store';
import useWebSocket from '../use-websocket';
import { Board } from './board';
import { Header } from './header';
import { LeftDrawer } from './left-drawer';
import { Panel } from './panel';
import { RightDrawer } from './right-drawer';
import { Setup } from '../setup';

export const Game = () => {
  const navigate = useNavigate();
  const { id: channel } = useParams<{ id: string }>();
  const { sendMessage } = useWebSocket(channel);
  const toast = useToast();
  const username = localStorage.getItem('username');
  const { players, setChannel, currentTurn } = useGameStore();
  const { currentRole, setCurrentRole, setCurrentPosition } = useRunnerStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    let isSubscribed = true;
    const checkGame = async () => {
      if (!channel) return;

      try {
        const game = await getGameByChannel(channel, abortController.signal);

        if (!isSubscribed) return;

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
          setLoading(false);
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
        if (!isSubscribed) return;
        if (error instanceof Error && error.name === 'AbortError') return;

        console.error('Game check error:', error);
        toast({
          title: 'Error',
          description: 'Game not found',
          status: 'error',
          duration: 9000,
          isClosable: true,
        });
        navigate('/');
      }
    };

    checkGame();
    return () => {
      isSubscribed = false;
      abortController.abort();
    };
  }, [
    channel,
    username,
    navigate,
    toast,
    setChannel,
    setCurrentRole,
    sendMessage,
  ]);

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

  if (loading) return <Setup renderSteps={false} />;

  return (
    <Flex height="100vh" bg="#1a202c" color="white">
      <LeftDrawer
        isLeftOpen={isLeftOpen}
        channel={channel}
        onLeftClose={onLeftClose}
        onRoleChange={onRoleChange}
      />

      <VStack maxW={150} bg="#8CC690" p={4} spacing={4} align="center">
        <Button onClick={onLeftOpen} leftIcon={<FiArrowLeft />}>
          Players
        </Button>
        <img
          className="w-20"
          src="/images/catch.png"
          alt="player"
          onClick={() => navigate('/')}
        />
        <Divider />
        <Panel />
      </VStack>

      <Flex flex="1" align="center" direction="column">
        <Board />
      </Flex>

      <VStack maxW={150} bg="#8CC690" p={4} spacing={4} align="center">
        <Button onClick={onRightOpen} rightIcon={<FiArrowRight />}>
          Moves
        </Button>
        <Heading size="md" color="gray.900">
          {currentRole === currentTurn ? 'Your Turn' : 'Next Turn'}
        </Heading>
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          cursor={currentRole !== 'culprit' ? 'pointer' : 'not-allowed'}
          onClick={() => onRoleChange(currentTurn)}
        >
          <img
            className="w-10 h-12"
            src={`/images/${currentTurn}.png`}
            alt="player"
          />
          {currentRole !== 'culprit' && (
            <Text fontSize="sm" color="teal.600" textAlign="center">
              Click to impersonate
            </Text>
          )}
          <Box fontSize="2xl" mt={2}>
            <span role="img" aria-label="dice">
              🎲
            </span>
          </Box>
        </Box>
        <Divider />
        <Header />
      </VStack>

      <RightDrawer isRightOpen={isRightOpen} onRightClose={onRightClose} />
    </Flex>
  );
};
