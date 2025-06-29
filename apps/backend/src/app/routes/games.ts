import { IpInfo, Move } from '@yard/shared-utils';
import { FastifyInstance } from 'fastify';
import { createGameState } from '../helpers/create-game';
import { hasActiveGame, updateGame } from '../helpers/db-operations';
import { addMove, createGame, saveIpInfo, updatePlayer } from '../helpers/db-transactions';
import {
  gameChannelSchema,
  updateGameSchema,
  playerIdSchema,
  updatePlayerSchema,
  moveSchema,
  ipInfoSchema,
  validateSchema
} from '../helpers/validation-schemas';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
  DatabaseError,
  wrapDatabaseOperation
} from '../helpers/error-handler';

export default async function (fastify: FastifyInstance) {
  // Get game by channel
  fastify.get<{ Params: { channel: string } }>(
    '/games/:channel',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            channel: { type: 'string', minLength: 1, maxLength: 50 }
          },
          required: ['channel']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              channel: { type: 'string' },
              players: { type: 'array' },
              currentTurn: { type: 'string' },
              moves: { type: 'array' },
              status: { type: 'string' },
              isDoubleMove: { type: 'boolean' }
            }
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  requestId: { type: 'string' },
                  timestamp: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    asyncHandler(async (request, reply) => {
      const { channel } = validateSchema(gameChannelSchema, request.params);

      const game = await wrapDatabaseOperation(
        () => hasActiveGame(channel),
        `fetch game with channel: ${channel}`
      );

      if (!game) {
        throw new NotFoundError('Game', channel);
      }

      reply.send(game);
    })
  );

  // Create New Game
  fastify.post('/games', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            createdGame: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                channel: { type: 'string' },
                players: { type: 'array' },
                currentTurn: { type: 'string' },
                moves: { type: 'array' },
                status: { type: 'string' },
                isDoubleMove: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, asyncHandler(async (request, reply) => {
    const { channel, players, currentTurn } = createGameState();

    const createdGame = await wrapDatabaseOperation(
      () => createGame(channel, players, currentTurn),
      'create new game'
    );

    reply.code(201).send({
      success: true,
      createdGame,
    });
  }));

  // Update a game
  fastify.patch<{ Params: { id: string } }>(
    '/games/:id',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body;

      if (Object.keys(body).length === 0) {
        return reply
          .code(400)
          .send({ success: false, error: 'No fields to update' });
      }

      try {
        const updatedGame = await updateGame(id, body);
        reply.code(200).send({ success: true, updatedGame });
      } catch (error) {
        console.error(error);
        reply
          .code(500)
          .send({ success: false, error: 'Failed to update game' });
      }
    }
  );

  // Update a player
  fastify.patch<{ Params: { id: string } }>(
    '/players/:id',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body;

      if (Object.keys(body).length === 0) {
        return reply
          .code(400)
          .send({ success: false, error: 'No fields to update' });
      }

      try {
        await updatePlayer(id, body);
        reply.code(200).send({ success: true });
      } catch (error) {
        console.error(error);
        reply
          .code(500)
          .send({ success: false, error: 'Failed to update player' });
      }
    }
  );

  // Add a move
  fastify.post<{ Body: Move }>('/moves', async (request, reply) => {
    try {
      const updatedGame = await addMove(request.body);
      reply.code(201).send({ success: true, updatedGame });
    } catch (error) {
      console.error('Failed to add move:', error);
      reply.code(500).send({ success: false, error: 'Failed to add move' });
    }
  });

  fastify.post<{ Body: IpInfo }>('/ip-info', async (request, reply) => {
    try {
      const ipInfo = await saveIpInfo(request.body);
      if (!ipInfo) {
        return reply.code(205).send();
      }
      return reply.code(201).send(ipInfo);
    } catch (error) {
      console.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
