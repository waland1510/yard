import { useEffect, useState, useCallback } from 'react';
import { getWebSocket } from './websocket-manager';
import { useGameStore } from '../stores/use-game-store';
import { log } from 'node:console';

type MessageType = 'startGame' | 'joinGame' | 'makeMove' | 'updateGameState';

interface Message {
  type: MessageType;
  channel: string; // Added channel to the message structure
  data: any;
}

const useWebSocket = (initialChannel?: string) => {
  console.log('initialChannel', initialChannel);

  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<string | undefined>(initialChannel); // State to manage the current channel
  const socket = getWebSocket();

  const setPosition = useGameStore((state) => state.setPosition);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message: Message = JSON.parse(event.data);
      setMessages((prev) => [...prev, message]);

      switch (message.type) {
        case 'joinGame':
          console.log('Player joined:', message.data);
          break;
        case 'makeMove':
          setPosition(message.data.role, message.data.target);
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
      if (channel) {
        if (socket.readyState === WebSocket.OPEN) {
          sendMessage('joinGame', { channel });
        } else {
          socket.onopen = () => sendMessage('joinGame', { channel });
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

  const joinChannel = (newChannel: string) => {
    setChannel(newChannel);
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendMessage('joinGame', { channel: newChannel });
    }
  };

  return { messages, sendMessage, joinChannel, channel };
};

export default useWebSocket;
