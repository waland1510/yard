import { useEffect, useState, useCallback } from 'react';
import { getWebSocket } from './websocket-manager';
import { useGameStore } from '../stores/use-game-store';
import { useRunnerStore } from '../stores/use-runner-store';
import { Message, MessageType } from '@yard/shared-utils';
import { useToast } from '@chakra-ui/react';

const useWebSocket = (initialChannel?: string) => {
  const toast = useToast()
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<string | undefined>(initialChannel); // State to manage the current channel
  const socket = getWebSocket();
  const username = sessionStorage.getItem('username');
  const currentRole = useRunnerStore((state) => state.currentRole);
  const setPosition = useGameStore((state) => state.setPosition);
  const setCurrentTurn = useGameStore((state) => state.setCurrentTurn);
  const setMovesCount = useGameStore((state) => state.setMovesCount);
  const updateMoves = useGameStore((state) => state.updateMoves);
  const updatePlayer = useGameStore((state) => state.updatePlayer);
  const updateTicketsCount = useGameStore((state) => state.updateTicketsCount);
  const setIsDoubleMove = useGameStore((state) => state.setIsDoubleMove);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message: Message = JSON.parse(event.data);
      setMessages((prev) => [...prev, message]);

      switch (message.type) {
        case 'joinGame':
          console.log('Player joined:', message.data.username);
          break;
        case 'makeMove':
          setPosition(message.data.role, message.data.position);
          updateTicketsCount(message.data.role, message.data.type, message.data.isSecret, message.data.isDouble);
          setIsDoubleMove(message.data.isDouble);
          setCurrentTurn(message.data.currentTurn);
          setMovesCount(message.data.movesCount);
          if(message.data.role === 'culprit') {
            updateMoves(message.data);
          }
          console.log('Move made:', message.data);
          toast({ description: `${message.data.role} moved to ${message.data.position}. Next turn - ${message.data.currentTurn}`, status: "warning", position: 'top-right', duration: 9000, isClosable: true })
          break;
        case 'updateGameState':
          useGameStore.setState({ ...message.data });
          console.log('Game state updated:', message.data.players);
          break;
        case 'impersonate':
          updatePlayer(message.data.role, message.data.username);
          console.log('Impersonating:', message.data.role);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    };

    if (socket) {
      socket.onmessage = handleMessage;
      if (channel && username) {
        if (socket.readyState === WebSocket.OPEN) {
          sendMessage('joinGame', { channel, username, currentRole });
        } else {
          socket.onopen = () => sendMessage('joinGame', { channel, username, currentRole });
        }
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
        console.warn('WebSocket is not connected');
      }
    },
    [socket, channel]
  );

  // const joinChannel = (newChannel: string) => {
  //   setChannel(newChannel);
  //   if (socket && socket.readyState === WebSocket.OPEN) {
  //     sendMessage('joinGame', { channel: newChannel });
  //   }
  // };

  return { messages, sendMessage,  channel };
};

export default useWebSocket;
