import React, { useEffect, useState } from 'react';

const WebSocketClient = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to the WebSocket server
    const ws = new WebSocket('ws://localhost:3000/ws');

    // Set up event listeners
    ws.onopen = () => {
      console.log('Connected to WebSocket server');
      setSocket(ws);
    };

    ws.onmessage = event => {
      console.log('Message from server:', event.data);
      setMessages(prev => [...prev, event.data]);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    ws.onerror = error => {
      console.error('WebSocket error:', error);
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (socket) {
      const message = `Hello from client at ${new Date().toLocaleTimeString()}`;
      socket.send(message);
    }
  };

  return (
    <div>
      <h1>WebSocket Client</h1>
      <button onClick={sendMessage}>Send Message</button>
      <ul>
        {/* {messages.map((msg, index) => ( */}
          <li >{messages[messages.length - 1]}</li>
        {/* ))} */}
      </ul>
    </div>
  );
};

export default WebSocketClient;
