import { useEffect, useState, useCallback } from 'react';
import { getWebSocket } from './websocket-manager';
import { useGameStore } from '../stores/use-game-store';
import { useRunnerStore } from '../stores/use-runner-store';
import { Message, MessageType, Move, RoleType } from '@yard/shared-utils';
import { useToast } from '@chakra-ui/react';
import { usePlayersSubscription } from '../hooks/use-players-subscription';
import { useTranslation } from 'react-i18next';

const useWebSocket = (channel?: string) => {
  const socket = getWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const username = localStorage.getItem('username');
  const toast = useToast();
  const { currentRole } = useRunnerStore();
  const {
    setPosition,
    setCurrentTurn,
    updateMoves,
    updatePlayer,
    updateTicketsCount,
    setIsDoubleMove,
    setStatus,
  } = useGameStore();
  const players = usePlayersSubscription();
  const { t } = useTranslation();

  const sendMessage = useCallback(
    (type: MessageType, data: any) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({ type, channel, data });
        socket.send(message);
      } else {
        console.warn('WebSocket is not connected');
        toast({
          description: t('websocketDisconnected'),
          status: 'error',
          position: 'top-right',
          duration: 5000,
          isClosable: true,
        });
      }
    },
    [socket, channel, toast, t]
  );

  useEffect(() => {
    const handleOpen = () => {
      setIsConnected(true);
      toast({
        description: t('websocketConnected'),
        status: 'success',
        position: 'top-right',
        duration: 3000,
        isClosable: true,
      });
    };

    const handleClose = () => {
      setIsConnected(false);
      toast({
        description: t('websocketDisconnected'),
        status: 'error',
        position: 'top-right',
        duration: 5000,
        isClosable: true,
      });

      // Attempt reconnection
      setTimeout(() => {
        if (socket && socket.readyState !== WebSocket.OPEN) {
          socket.onopen = handleOpen;
        }
      }, 5000);
    };

    const handleError = (error: Event) => {
      console.error('WebSocket error:', error);
      toast({
        description: t('websocketError'),
        status: 'error',
        position: 'top-right',
        duration: 5000,
        isClosable: true,
      });
    };

    if (socket) {
      socket.onopen = handleOpen;
      socket.onclose = handleClose;
      socket.onerror = handleError;
    }

    return () => {
      if (socket) {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
      }
    };
  }, [socket, toast, t]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message: Message = JSON.parse(event.data);
      setMessages((prev) => [...prev, message]);

      switch (message.type) {
        case 'joinGame':
          if (
            !message.data.role ||
            players.find((p) => p.username === message.data.username)
          )
            return;
          updatePlayer(message.data.role, message.data.username);
          toast({
            description: `${message.data.username} joined as ${t(
              message.data.role
            )}`,
            status: 'success',
            position: 'top-right',
            duration: 9000,
            isClosable: true,
          });

          break;
        case 'makeMove':
          setPosition(message.data.role as RoleType, message.data.position as number);
          updateTicketsCount(
            message.data.role,
            message.data.type,
            message.data.secret,
            message.data.double
          );
          setIsDoubleMove(message.data.double);
          setCurrentTurn(message.data.currentTurn);
          if (message.data.role === 'culprit') {
            updateMoves(message.data as Move);
            toast({
              description: t('culpritMove', {
                culprit: t('culprit'),
                nextTurn: t(message.data.currentTurn as string),
              }),
              status: 'error',
              position: 'top-right',
              duration: 6000,
              isClosable: true,
            });
          } else {
            toast({
              description: t('playerMove', {
                player: t(message.data.role as string),
                position: message.data.position,
                nextTurn: t(message.data.currentTurn as string),
              }),
              status: 'success',
              position: 'top-right',
              duration: 6000,
              isClosable: true,
            });
          }
          break;
        case 'updateGameState':
          console.log('Game state updated:', message.data.players);
          break;
        case 'impersonate':
          updatePlayer(message.data.role, message.data.username);
          console.log('Impersonating:', message.data.role);
          break;
        case 'endGame':
          setStatus('finished');
          toast({
            description: t('gameOver', { winner: t(message.data.winner || 'unknown') }),
            status: 'success',
            position: 'top-right',
            duration: 9000,
            isClosable: true,
          });
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    };

    if (socket) {
      socket.onmessage = handleMessage;

      if (!channel || !username || !currentRole) return;

      const joinGameIfNeeded = () => {
        if (!players.find((p) => p.username === username)) {
          sendMessage('joinGame', { channel, username, currentRole });
        }
      };

      if (socket.readyState !== WebSocket.OPEN) {
        socket.onopen = joinGameIfNeeded;
      }
    }

    return () => {
      if (socket) {
        socket.onmessage = null;
      }
    };
  }, [socket, channel, players, updatePlayer, toast, setPosition, updateTicketsCount, setIsDoubleMove, setCurrentTurn, updateMoves, username, currentRole, sendMessage, t, setStatus]);

  return { messages, sendMessage, channel, isConnected };
};

export default useWebSocket;
