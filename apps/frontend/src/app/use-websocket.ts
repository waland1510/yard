import { useEffect, useState, useCallback } from 'react';
import { getWebSocket } from './websocket-manager';
import { useGameStore } from '../stores/use-game-store';
import { useRunnerStore } from '../stores/use-runner-store';
import { Message, MessageType } from '@yard/shared-utils';

const useWebSocket = (initialChannel?: string) => {

  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<string | undefined>(initialChannel); // State to manage the current channel
  const socket = getWebSocket();
  const username = sessionStorage.getItem('username');
  const currentRole = useRunnerStore((state) => state.currentRole);
  const setPosition = useGameStore((state) => state.setPosition);
  const setCurrentTurn = useGameStore((state) => state.setCurrentTurn);
  const setMovesCount = useGameStore((state) => state.setMovesCount);
  const updateTicketsCount = useGameStore((state) => state.updateTicketsCount);

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
          updateTicketsCount(message.data.role, message.data.type, message.data.isDouble);
          setCurrentTurn(message.data.currentTurn);
          setMovesCount(message.data.movesCount);
          console.log('Move made:', message.data);
          break;
        case 'updateGameState':
          useGameStore.setState({ ...message.data });
          console.log('Game state updated:', message.data.players);
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
