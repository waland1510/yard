import {
  Box,
  Button,
  Flex,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { RoleType } from '@yard/shared-utils';
import { useEffect } from 'react';
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

export const Game = () => {
  const navigate = useNavigate();
  const { id: channel } = useParams<{ id: string }>();
  const { sendMessage } = useWebSocket(channel);
  const toast = useToast();
  const username = localStorage.getItem('username');
  const { players, setChannel, currentTurn } = useGameStore();
  const { currentRole, setCurrentRole, setCurrentPosition } = useRunnerStore();

  useEffect(() => {
    const abortController = new AbortController();
    let isSubscribed = true;

    const checkGame = async () => {
      if (!channel) return;

      try {
        const game = await getGameByChannel(channel, abortController.signal);

        // Only proceed if component is still mounted
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

    // Cleanup function
    return () => {
      isSubscribed = false;
      abortController.abort();
    };
  }, [channel, username, navigate, toast]); // Added proper dependencies

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
    <Flex height="100vh" bg="#edf2f7">
      <LeftDrawer
        isLeftOpen={isLeftOpen}
        channel={channel}
        onLeftClose={onLeftClose}
        onRoleChange={onRoleChange}
      />
      {/* Left Sidebar Compact */}
      <Box
        w="100%"
        maxW={150}
        h="100vh"
        p={2}
        bg="#edf2f7"
        display="flex"
        flexDirection="column"
        alignItems="center"
      >
        <Button onClick={onLeftOpen} leftIcon={<FiArrowLeft />}>
          Players
        </Button>
        <img
          className="w-20"
          src="/images/catch.png"
          alt="player"
          onClick={() => navigate('/')}
        />
        <Panel />
      </Box>

      {/* Main Content */}
      <Flex flex="1" align="center" direction="column">
        <Board />
      </Flex>

      <RightDrawer isRightOpen={isRightOpen} onRightClose={onRightClose} />

      {/* Right Sidebar Compact */}
      <Box
        w="100%"
        maxW={150}
        p={2}
        bg="#edf2f7"
        display="flex"
        flexDirection="column"
        alignItems="center"
      >
        <Button onClick={onRightOpen} rightIcon={<FiArrowRight />}>
          Moves
        </Button>
        <div className="flex flex-col gap-3 items-center justify-between px-4 py-2 mb-5">
          <div className="text-lg">Current Turn</div>
          <div className="text-sm">{currentTurn}</div>
          <img
            className="w-10 h-12"
            src={`/images/${currentTurn}.png`}
            alt="player"
            onClick={() => onRoleChange(currentTurn)}
          />
          <span className="text-2xl" role="img" aria-label="dice">
            🎲
          </span>
        </div>
        <Header />
      </Box>
    </Flex>
  );
};
