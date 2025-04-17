import { useToast } from '@chakra-ui/react';
import { Message, RoleType } from '@yard/shared-utils';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/use-game-store';
import { updatePlayer } from '../api';
import { useTranslation } from 'react-i18next';

const WS_URL = import.meta.env.VITE_WS_URL;

export default function useWebSocket(channel: string | undefined) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { players, currentTurn, status, setStatus, updatePlayer } = useGameStore();
  const toast = useToast();
  const { t } = useTranslation();
  const username = localStorage.getItem('username');
  const currentRole = localStorage.getItem('currentRole') as RoleType;
  const socketRef = useRef<WebSocket | null>(null);

  const sendMessage = (type: Message['type'], data: Message['data']) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type,
          data,
          channel,
        })
      );
    }
  };

  useEffect(() => {
    if (!WS_URL) return;

    const ws = new WebSocket(WS_URL);
    setSocket(ws);
    socketRef.current = ws;

    const handleMessage = (event: MessageEvent) => {
      const message: Message = JSON.parse(event.data);

      switch (message.type) {
        case 'joinGame':
          updatePlayer(message.data.role, message.data.username);
          break;

        case 'makeMove':
          if (message.data.role && message.data.position) {
            // Find the next player
            const nextPlayer = players.find(p => p.role === message.data.currentTurn);
            
            // If next player is AI, include game state in the move data
            if (nextPlayer?.isAI) {
              sendMessage('makeMove', {
                ...message.data,
                gameState: useGameStore.getState(),
                player: nextPlayer,
                isAI: true
              });
            }

            useGameStore.setState((state) => ({
              ...state,
              currentTurn: message.data.currentTurn,
            }));
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
            description: t('gameOver', {winner: t(message.data.winner)}),
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
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current?.close();
      }
    };
  }, [channel, username, currentRole]);

  return { socket, sendMessage };
}
