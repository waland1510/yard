import { useEffect, useState, useCallback } from 'react';
import { getWebSocket } from './websocket-manager';
import { useGameStore } from '../stores/use-game-store';

type MessageType = 'joinGame' | 'makeMove' | 'updateGameState';

interface Message {
  type: MessageType;
  data: any;
}

const useWebSocket = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const socket = getWebSocket();

  const setPosition = useGameStore((state) => state.setPosition);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message: Message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);

      switch (message.type) {
        case 'joinGame':
          // Handle joinGame event
          console.log('Player joined:', message.data);
          break;
        case 'makeMove':
          // Handle makeMove event
          setPosition(message.data.role, message.data.target);
          console.log('Move made:', message.data);
          break;
        case 'updateGameState':
          // Handle updateGameState event
          useGameStore.setState({ ...message.data });
          console.log('Game state updated:', message.data.players);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    };

    if (socket) {
      socket.onmessage = handleMessage;
    }

    return () => {
      if (socket) {
        socket.onmessage = null; // Cleanup listener on unmount
      }
    };
  }, [socket]);

  const sendMessage = useCallback((type: MessageType, data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, data });
      socket.send(message);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, [socket]);

  return { messages, sendMessage };
};

export default useWebSocket;
