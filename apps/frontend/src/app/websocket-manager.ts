let socket: WebSocket | null = null;

export const getWebSocket = () => {
  if (!socket) {
    const url = import.meta.env.VITE_WS_URL;
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
