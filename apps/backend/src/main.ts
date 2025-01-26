import Fastify from 'fastify';
import { app } from './app/app';
import ws from '@fastify/websocket';
import {
  initialPlayers,
  Player,
  GameState,
  Role,
  RoleType,
  Message,
  getNextRole,
} from '@yard/shared-utils';
import cors from '@fastify/cors'

// const host = process.env.HOST ?? 'localhost';
const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = Fastify();

server.register(cors, {
  origin: [process.env.FRONTEND_URL],
  methods: ['GET', 'POST', 'PUT', 'PATCH'],  // Allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'],  // Allowed headers
});

const channels: Record<string, Set<any>> = {};

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
            channels[currentChannel].add(connection);
            console.log(`Client joined channel: ${currentChannel}`);
            break;

          case 'joinGame': {
            currentChannel = parsedMessage.channel;
            if (!channels[currentChannel]) {
              return;
            }
            channels[currentChannel].add(connection);

            broadcast(currentChannel, {
              type: 'joinGame',
              data: parsedMessage.data.username,
            });

            // const player: Player = gameState.players?.find(
            //   (p) => p.role === parsedMessage.data.currentRole
            // );
            // if (player) {
            //   player.username = parsedMessage.data.username;
            // } else {
            //   console.log('Player not found');
            // }

            // broadcast(currentChannel, {
            //   type: 'updateGameState',
            //   data: { ...gameState, movesCount: gameState.moves.length },
            // });
            break;
          }

          case 'updateGameState':
            if (currentChannel) {
              // gameState.players = parsedMessage.data.players;
              // broadcast(currentChannel, {
              //   type: 'updateGameState',
              //   data: parsedMessage.data,
              // });
            }
            break;

          case 'impersonate':
            if (currentChannel) {
              // const { role, username } = parsedMessage.data;
              // const player = gameState.players?.find((p) => p.role === role);
              // if (player) {
              //   player.username = username;
              // }
              // broadcast(currentChannel, {
              //   type: 'updateGameState',
              //   data: { ...gameState, movesCount: gameState.moves.length },
              // });
              broadcast(currentChannel, {
                type: 'impersonate',
                data: parsedMessage.data,
              });
            }
            break;

          case 'makeMove':
            if (currentChannel) {
              const { role, isDouble } = parsedMessage.data;
              const currentTurn = getNextRole(role, isDouble);
              // gameState.currentTurn =currentTurn
              // if (role === 'culprit') {
              //   gameState.moves.push(parsedMessage.data);
              // }

              broadcast(currentChannel, {
                type: 'makeMove',
                data: {
                  ...parsedMessage.data,
                  currentTurn,
                  // movesCount: gameState.moves.length,
                },
              });
            }
            break;

          default:
            console.warn('Unknown message type:', parsedMessage.type);
        }
      });

      connection.on('close', () => {
        if (currentChannel && channels[currentChannel]) {
          channels[currentChannel].delete(connection);
          console.log(
            `Client disconnected from channel: ${currentChannel}. Remaining clients: ${channels[currentChannel].size}`
          );

          // Clean up the channel if empty
          // if (channels[currentChannel].size === 0) {
          //   delete channels[currentChannel];
          //   console.log(`Channel ${currentChannel} deleted`);
          // }
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
