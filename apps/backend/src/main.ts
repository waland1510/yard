import cors from '@fastify/cors';
import ws from '@fastify/websocket';
import { GameState, getNextRole, Message, Move, Player, RoleType } from '@yard/shared-utils';
import Fastify from 'fastify';
import { app } from './app/app';
import { hasActiveGame } from './app/routes/games';
import { AIPlayerService } from './app/helpers/ai-player';

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = Fastify();
const aiService = new AIPlayerService();

server.register(cors, {
  origin: [process.env.FRONTEND_URL],
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

const channels: Record<string, Set<WebSocket>> = {};

server.register(app);
server.register(ws);

const broadcast = (channel: string, message: Message) => {
  channels[channel]?.forEach((client: WebSocket) => {
    client.send(JSON.stringify(message));
  });
};

server.register(async function (fastify) {
  fastify.get(
    '/*',
    { websocket: true },
    (connection /* WebSocket */) => {
      let currentChannel: string | null = null;

      connection.on('message', async (message) => {
        const parsedMessage: Message = JSON.parse(message.toString());
        
        try {
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
                const game = await hasActiveGame(currentChannel);
                if (game) {
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
              break;
            }

            case 'makeMove':
              if (currentChannel && parsedMessage.data.gameState) {
                const { role, double, isAI, gameState, player } = parsedMessage.data;
                const currentTurn = getNextRole(role as RoleType, double || false);

                // Broadcast the current move
                broadcast(currentChannel, {
                  type: 'makeMove',
                  data: {
                    ...parsedMessage.data,
                    currentTurn,
                  },
                });

                // If next player is AI, automatically make their move
                if (isAI && gameState && player) {
                  try {
                    const nextPlayer = gameState.players.find(p => p.role === currentTurn);
                    if (nextPlayer?.isAI) {
                      const aiMove = await aiService.calculateMove(
                        gameState as GameState,
                        nextPlayer as Player
                      );

                      // Broadcast AI move
                      broadcast(currentChannel, {
                        type: 'makeMove',
                        data: {
                          ...aiMove,
                          currentTurn: getNextRole(currentTurn, aiMove.double || false),
                        },
                      });
                    }
                  } catch (error) {
                    console.error('AI move calculation failed:', error);
                    connection.send(
                      JSON.stringify({
                        type: 'error',
                        data: 'AI move calculation failed',
                      })
                    );
                  }
                }
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
        } catch (error) {
          console.error('WebSocket message handling error:', error);
          connection.send(
            JSON.stringify({
              type: 'error',
              data: 'Internal server error',
            })
          );
        }
      });

      connection.on('close', () => {
        if (currentChannel) {
          channels[currentChannel].delete(connection as unknown as WebSocket);
          if (channels[currentChannel].size === 0) {
            delete channels[currentChannel];
          }
        }
      });
    }
  );
});

server.listen({ port, host }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
