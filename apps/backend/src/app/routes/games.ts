import { IpInfo, Move } from '@yard/shared-utils';
import { FastifyInstance } from 'fastify';
import { createGameState } from '../helpers/create-game';
import { hasActiveGame, updateGame } from '../helpers/db-operations';
import { addMove, createGame, saveIpInfo, updatePlayer } from '../helpers/db-transactions';

export default async function (fastify: FastifyInstance) {
  fastify.get<{ Params: { channel: string } }>(
    '/games/:channel',
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
  fastify.post('/games', async (request, reply) => {
    const { channel, players, currentTurn } = createGameState();
    try {
      const createdGame = await createGame(channel, players, currentTurn);
      reply.code(201).send({
        success: true,
        createdGame,
      });
    } catch (error) {
      console.error(error);
      reply.code(500).send({ success: false, error: 'Failed to save game' });
    }
  });

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
