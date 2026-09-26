import { GameState, IpInfo, Move, Player } from '@yard/shared-utils';
import { FastifyInstance } from 'fastify';
import { createGameState } from '../helpers/create-game';
import { hasActiveGame, updateGame } from '../helpers/db-operations';
import { addMove, createGame, saveIpInfo, updatePlayer } from '../helpers/db-transactions';

const ROLES = ['culprit', 'detective1', 'detective2', 'detective3', 'detective4', 'detective5'];
const MOVE_TYPES = ['taxi', 'bus', 'underground', 'river'];
const NODE_ID = { type: 'integer', minimum: 1, maximum: 200 };
const TICKETS = { type: 'integer', minimum: 0 };
const NUMERIC_ID_PARAMS = {
  type: 'object',
  properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
  required: ['id'],
};

export default async function (fastify: FastifyInstance) {
  fastify.get<{ Params: { channel: string } }>(
    '/games/:channel',
    {
      schema: {
        params: {
          type: 'object',
          properties: { channel: { type: 'string', minLength: 1, maxLength: 50 } },
          required: ['channel'],
        },
      },
    },
    async (request, reply) => {
      try {
        const game = await hasActiveGame(request.params.channel);
        if (!game)
          return reply
            .code(404)
            .send({ success: false, error: 'Game not found' });

        reply.send(game);
      } catch (error) {
        console.error(error);
        reply
          .code(500)
          .send({ success: false, error: 'Failed to fetch game data' });
      }
    }
  );

  // Create New Game
  fastify.post<{ Body: { theme?: string; withAI?: boolean } | undefined }>(
    '/games',
    {
      schema: {
        body: {
          type: ['object', 'null'],
          properties: {
            theme: { type: 'string', maxLength: 50 },
            withAI: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
    const { theme } = request.body ?? {};
    const { channel, players, currentTurn } = createGameState(theme);
    try {
      const createdGame = await createGame(channel, players, currentTurn, theme);
      reply.code(201).send({
        success: true,
        createdGame,
      });
    } catch (error) {
      console.error(error);
      reply.code(500).send({ success: false, error: 'Failed to save game' });
    }
  }
  );

  // Update a game
  fastify.patch<{ Params: { id: string }; Body: Partial<GameState> }>(
    '/games/:id',
    {
      schema: {
        params: NUMERIC_ID_PARAMS,
        body: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'finished'] },
            currentTurn: { type: 'string', enum: ROLES },
            isDoubleMove: { type: 'boolean' },
          },
          additionalProperties: false,
        },
      },
    },
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
  fastify.patch<{ Params: { id: string }; Body: Partial<Player> }>(
    '/players/:id',
    {
      schema: {
        params: NUMERIC_ID_PARAMS,
        body: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 255 },
            isAI: { type: 'boolean' },
            position: NODE_ID,
            taxiTickets: TICKETS,
            busTickets: TICKETS,
            undergroundTickets: TICKETS,
            secretTickets: TICKETS,
            doubleTickets: TICKETS,
          },
          additionalProperties: false,
        },
      },
    },
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
  fastify.post<{ Body: Move }>(
    '/moves',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            gameId: { type: 'integer', minimum: 1 },
            role: { type: 'string', enum: ROLES },
            type: { type: 'string', enum: MOVE_TYPES },
            position: NODE_ID,
            secret: { type: 'boolean' },
            double: { type: 'boolean' },
          },
          required: ['gameId', 'role', 'type', 'position'],
        },
      },
    },
    async (request, reply) => {
    try {
      const updatedGame = await addMove(request.body);
      reply.code(201).send({ success: true, updatedGame });
    } catch (error) {
      console.error('Failed to add move:', error);
      reply.code(500).send({ success: false, error: 'Failed to add move' });
    }
  }
  );

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
