import { useEffect, useState, useCallback } from 'react';
import { getWebSocket } from './websocket-manager';
import { useGameStore } from '../stores/use-game-store';
import { useRunnerStore } from '../stores/use-runner-store';
import { Message, MessageType } from '@yard/shared-utils';
import { useToast } from '@chakra-ui/react';
import { usePlayersSubscription } from '../hooks/use-players-subscription';

const useWebSocket = (initialChannel?: string) => {
  // console.log('initialChannel', initialChannel);
  const socket = getWebSocket();
  const [channel, setChannel] = useState<string | undefined>(initialChannel); // State to manage the current channel
  const [messages, setMessages] = useState<Message[]>([]);
  const username = localStorage.getItem('username');
  const toast = useToast();
  const currentRole = useRunnerStore((state) => state.currentRole);
  const setPosition = useGameStore((state) => state.setPosition);
  const setCurrentTurn = useGameStore((state) => state.setCurrentTurn);
  const updateMoves = useGameStore((state) => state.updateMoves);
  const updatePlayer = useGameStore((state) => state.updatePlayer);
  const updateTicketsCount = useGameStore((state) => state.updateTicketsCount);
  const setIsDoubleMove = useGameStore((state) => state.setIsDoubleMove);
  const players = usePlayersSubscription();
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message: Message = JSON.parse(event.data);
      setMessages((prev) => [...prev, message]);
      console.log('Received:', message);

      switch (message.type) {
        case 'joinGame':
          if (players.find((p) => p.username === (message.data.username))) return;
          updatePlayer(message.data.role, message.data.username);
          toast({
            description: `New player joined: ${message.data}`,
            status: 'success',
            position: 'top-right',
            duration: 9000,
            isClosable: true,
          });
          break;
        case 'makeMove':
          setPosition(message.data.role, message.data.position);
          updateTicketsCount(
            message.data.role,
            message.data.type,
            message.data.secret,
            message.data.double
          );
          setIsDoubleMove(message.data.double);
          setCurrentTurn(message.data.currentTurn);
          if (message.data.role === 'culprit') {
            updateMoves(message.data);
            toast({
              description: `Mr.C made his move. Next is ${message.data.currentTurn}`,
              status: 'error',
              position: 'top-right',
              duration: 9000,
              isClosable: true,
            });
          } else {
          toast({
            description: `${message.data.role} moved to ${message.data.position}. Next is ${message.data.currentTurn}`,
            status: 'warning',
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
          toast({
            description: `Game ended. Winner: ${message.data.winner}`,
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
        socket.onmessage = null; // Cleanup listener on unmount
      }
    };
  }, [socket, channel]);

  const sendMessage = useCallback(
    (type: MessageType, data: any) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({ type, channel, data }); // Include the channel in every message
        socket.send(message);
      } else {
        console.log({ type, channel, data });
        console.warn('WebSocket is not connected');
      }
    },
    [socket, channel]
  );

  // const joinChannel = (newChannel: string, username, currentRole) => {
  //   setChannel(newChannel);
  //   if (socket && socket.readyState === WebSocket.OPEN) {
  //     sendMessage('joinGame', { channel: newChannel, username, currentRole });
  //   }
  // };

  return { messages, sendMessage, channel };
};

export default useWebSocket;
