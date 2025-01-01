import { useEffect, useState, useCallback } from 'react';
import { getWebSocket } from './websocket-manager';

const useWebSocket = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const socket = getWebSocket();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      setMessages(prev => [...prev, event.data]);
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

  const sendMessage = useCallback((message: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, [socket]);

  return { messages, sendMessage };
};

export default useWebSocket;
