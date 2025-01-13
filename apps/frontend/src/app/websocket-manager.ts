// WebSocketManager.ts
let socket: WebSocket | null = null;

export const getWebSocket = () => {
  if (!socket) {
    // const url = 'https://sr-replace-illness-sao.trycloudflare.com/ws';
    const url = 'ws://localhost:3000/ws';
    socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('WebSocket connected');
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      socket = null; // Reset to allow reconnecting if needed
    };

    socket.onerror = error => {
      console.error('WebSocket error:', error);
    };
  }

  return socket;
};
