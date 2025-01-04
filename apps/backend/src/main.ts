import Fastify from 'fastify';
import { app } from './app/app';

import ws from '@fastify/websocket';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = Fastify();

interface Message {
  type: string;
  data: any;
}

const clients = new Set<any>();

const gameState = {
  players: [],
};

server.register(app);
server.register(ws);

server.register(async function (fastify) {
  fastify.get(
    '/*',
    { websocket: true },
    (connection /* WebSocket */, req /* FastifyRequest */) => {
      // Add the new connection to the set of clients
      clients.add(connection);
      console.log('Client connected:', clients.size);

      connection.on('message', (message) => {
        const parsedMessage: Message = JSON.parse(message.toString());
        console.log('Received:', parsedMessage);

        switch (parsedMessage.type) {
          case 'updateGameState':
            broadcast({ type: 'updateGameState', data: parsedMessage.data });
            break;
          case 'makeMove':
            broadcast({ type: 'makeMove', data: parsedMessage.data });
            break;
          default:
            console.warn('Unknown message type:', parsedMessage.type);
        }
      });

      connection.on('close', () => {
        // Remove the connection from the set on disconnection
        clients.delete(connection);
        console.log('Client disconnected:', clients.size);
      });
    }
  );
});

const broadcast = (message: Message) => {
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
};

server.listen({ port, host }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
