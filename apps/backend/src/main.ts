import cors from '@fastify/cors';
import ws from '@fastify/websocket';
import { getNextRole, Message } from '@yard/shared-utils';
import Fastify from 'fastify';
import { app } from './app/app';

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = Fastify();

server.register(cors, {
  origin: [process.env.FRONTEND_URL],
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

const channels: Record<string, Set<WebSocket>> = {};

server.register(app);
server.register(ws);

server.register(async function (fastify) {
  fastify.get(
    '/*',
    { websocket: true },
    (connection /* WebSocket */, req /* FastifyRequest */) => {
      let currentChannel: string | null = null;

      connection.on('message', (message) => {
        const parsedMessage: Message = JSON.parse(message.toString());
        console.log('Received:', parsedMessage);
        switch (parsedMessage.type) {
          case 'startGame':
            currentChannel = parsedMessage.data.ch;
            channels[currentChannel] = new Set();
            channels[currentChannel].add(connection as unknown as WebSocket);
            console.log(`Client joined channel: ${currentChannel}`);
            break;

          case 'joinGame': {
            currentChannel = parsedMessage.channel;
            if (!channels[currentChannel]) {
              return;
            }
            channels[currentChannel].add(connection as unknown as WebSocket);

            broadcast(currentChannel, {
              type: 'joinGame',
              data: {
                username: parsedMessage.data.username,
                role: parsedMessage.data.role,
              },
            });
            break;
          }

          case 'updateGameState':
            if (currentChannel) {
              // broadcast(currentChannel, {
              //   type: 'updateGameState',
              //   data: parsedMessage.data,
              // });
            }
            break;

          case 'impersonate':
            if (currentChannel) {
              broadcast(currentChannel, {
                type: 'impersonate',
                data: parsedMessage.data,
              });
            }
            break;

          case 'makeMove':
            if (currentChannel) {
              const { role, double } = parsedMessage.data;
              const currentTurn = getNextRole(role, double);

              broadcast(currentChannel, {
                type: 'makeMove',
                data: {
                  ...parsedMessage.data,
                  type: parsedMessage.data.secret ? 'secret' : parsedMessage.data.type,
                  currentTurn,
                },
              });
            }
            break;

          case 'endGame':
            if (currentChannel) {
              broadcast(currentChannel, {
                type: 'endGame',
                data: parsedMessage,
              });
              delete channels[currentChannel];
            }
            break;

          default:
            console.warn('Unknown message type:', parsedMessage.type);
        }
      });

      connection.on('close', () => {
        if (currentChannel && channels[currentChannel]) {
          channels[currentChannel].delete(connection as unknown as WebSocket);
          console.log(
            `Client disconnected from channel: ${currentChannel}. Remaining clients: ${channels[currentChannel].size}`
          );
        }
      });
    }
  );
});

const broadcast = (channel: string, message: Message) => {
  const clients = channels[channel];
  if (clients) {
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
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
