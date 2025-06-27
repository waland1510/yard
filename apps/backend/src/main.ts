import cors from '@fastify/cors';
import ws from '@fastify/websocket';
import { getNextRole, Message, Player, RoleType } from '@yard/shared-utils';
import { fastify } from 'fastify';
import { setTimeout } from 'timers/promises';
import { app } from './app/app';
import { AIPlayerService } from './app/helpers/ai-player';
import { addMove, hasActiveGame, updateGame } from './app/helpers/db-operations';
import { ENV } from './app/helpers/env';
import { setupGracefulShutdown } from './app/helpers/error-handler';
import {
  incrementWebSocketConnection,
  decrementWebSocketConnection,
  incrementWebSocketMessage
} from './app/plugins/monitoring';

const host = ENV.HOST;
const port = ENV.PORT;

const server = fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        hostname: req.hostname,
        remoteAddress: req.ip,
        remotePort: req.socket?.remotePort,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  },
  ignoreTrailingSlash: true,
  trustProxy: true, // Important for getting real IP addresses
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
});

const aiService = new AIPlayerService();

// Register CORS
server.register(cors, {
  origin: [ENV.FRONTEND_URL],
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

const channels: Record<string, Set<WebSocket>> = {};

// Register plugins and routes
server.register(app);
server.register(ws);

// Setup graceful shutdown
setupGracefulShutdown(server, server.log);

async function handleAIMove(currentTurn, currentChannel) {
  const game = await hasActiveGame(currentChannel);
  try {
    const nextPlayer = game.players.find(p => p.role === currentTurn);
    if (nextPlayer?.isAI) {
      console.log('AI player found:', nextPlayer);
      const aiMove = await aiService.calculateMove(
        game,
        nextPlayer as Player
      );

      // Add a 2-second timeout before checking the next turn
      await setTimeout(2000);

      // Broadcast AI move
      broadcast(currentChannel, {
        type: 'makeMove',
        data: {
          ...aiMove,
          currentTurn: getNextRole(currentTurn, aiMove.double || false),
        },
      });

      // Update the game state with the AI move
      await addMove(game.id, aiMove.role, aiMove.type, aiMove.position, aiMove.secret, aiMove.double);

      // Fetch the updated game state
      await updateGame(game.id, {
        currentTurn: getNextRole(aiMove.role, aiMove.double || false),
      });

      // Check if the next turn is also an AI and recursively call handleAIMove
      const nextTurn = getNextRole(aiMove.role, aiMove.double || false);
      const nextAIPlayer = game.players.find(p => p.role === nextTurn);
      if (nextAIPlayer?.isAI) {
        await handleAIMove(nextTurn, currentChannel);
      }
    }
  } catch (error) {
    console.error('AI move calculation failed:', error);
  }
}

server.register(async function (fastify) {
  fastify.get(
    '/*',
    { websocket: true },
    (connection /* WebSocket */) => {
      let currentChannel: string | null = null;

      connection.on('message', async (message) => {
        const parsedMessage: Message = JSON.parse(message.toString());
        incrementWebSocketMessage('received');

        switch (parsedMessage.type) {
          case 'startGame':
            currentChannel = parsedMessage.data.ch;
            channels[currentChannel] = new Set();
            channels[currentChannel].add(connection as unknown as WebSocket);
            incrementWebSocketConnection();
            server.log.info(`Client joined channel: ${currentChannel}`);
            break;

          case 'joinGame': {
            currentChannel = parsedMessage.channel;

            const game = await hasActiveGame(currentChannel);
            if (!channels[currentChannel]) {
              if (game.status === 'active') {
                channels[currentChannel] = new Set();
              } else {
                connection.send(
                  JSON.stringify({
                    type: 'error',
                    data: 'Game not found',
                  })
                );
                return;
              }
            }
            channels[currentChannel].add(connection as unknown as WebSocket);

            broadcast(currentChannel, {
              type: 'joinGame',
              data: {
                username: parsedMessage.data.username,
                role: parsedMessage.data.role,
              },
            });
            if (!game.moves.length) {
            try {
              const nextPlayer = game.players.find(p => p.role === 'culprit');
              if (nextPlayer?.isAI) {
                await handleAIMove('culprit', currentChannel);
              }
            } catch (error) {
              console.error('AI move calculation failed:', error);
              connection.send(
                JSON.stringify({
                  type: 'error',
                  data: 'AI move calculation failed',
                })
              );
            }}
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
              const currentTurn = getNextRole(role as RoleType, double || false);

              // Broadcast the current move
              broadcast(currentChannel, {
                type: 'makeMove',
                data: {
                  ...parsedMessage.data,
                  currentTurn,
                },
              });

              await handleAIMove(currentTurn, currentChannel);
            }
            break;

          case 'endGame':
            if (currentChannel) {
              broadcast(currentChannel, {
                type: 'endGame',
                data: parsedMessage.data,
              });
              delete channels[currentChannel];
            }
            break;

          default:
            console.warn('Unknown message type:', parsedMessage.type);
        }
      });

      connection.on('close', () => {
        if (currentChannel) {
          channels[currentChannel].delete(connection as unknown as WebSocket);
          decrementWebSocketConnection();
          if (channels[currentChannel].size === 0) {
            delete channels[currentChannel];
            server.log.info(`Channel ${currentChannel} closed - no more clients`);
          }
        }
      });
    }
  );
});

const broadcast = (channel: string, message: Message) => {
  const clients = channels[channel];
  if (clients) {
    let sentCount = 0;
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
        incrementWebSocketMessage('sent');
        sentCount++;
      }
    }
    server.log.debug(`Broadcasted message to ${sentCount} clients in channel ${channel}`);
  }
};

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
