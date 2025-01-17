import { runQuery, GameState } from '@yard/shared-utils';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const getGameByChannel = `
  SELECT 
    g.id AS game_id,
    g.channel,
    g.game_mode,
    g.created_at AS game_created_at,
    g.updated_at AS game_updated_at,
    json_agg(
      json_build_object(
        'id', p.id,
        'username', p.username,
        'role', p.role,
        'position', p.position,
        'taxiTickets', p.taxi_tickets,
        'busTickets', p.bus_tickets,
        'undergroundTickets', p.underground_tickets,
        'secretTickets', p.secret_tickets,
        'doubleTickets', p.double_tickets
      )
    ) AS players,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'role', m.role,
            'move_type', m.move_type,
            'is_secret', m.is_secret,
            'is_double', m.is_double,
            'position', m.position,
            'created_at', m.created_at
          )
        )
        FROM moves m
        WHERE m.game_id = g.id
      ), '[]'  -- Empty array if no moves exist
    ) AS moves
  FROM games g
  LEFT JOIN players p ON p.game_id = g.id
  WHERE g.channel = $1
  GROUP BY g.id;
`;

const createGame = `
  INSERT INTO games (channel, game_mode, created_at, updated_at)
  VALUES ($1, $2, NOW(), NOW())
  RETURNING id;
`;

const insertPlayer = `
  INSERT INTO players (game_id, username, role, position, taxi_tickets, bus_tickets, underground_tickets, secret_tickets, double_tickets)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
`;

const updateGame = `
  UPDATE games
  SET channel = $1, game_mode = $2, updated_at = NOW()
  WHERE id = $3;
`;

const updatePlayer = `
  UPDATE players
  SET username = $1, role = $2, position = $3, taxi_tickets = $4, bus_tickets = $5, underground_tickets = $6, secret_tickets = $7, double_tickets = $8
  WHERE id = $9;
`;

const insertMove = `
  INSERT INTO moves (game_id, role, move_type, is_secret, is_double, position, created_at)
  VALUES ($1, $2, $3, $4, $5, $6, NOW());
`;

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/api/games/:channel',
    async (request: FastifyRequest<{ Params: { channel: string } }>) => {
      const { channel } = request.params;
      const { rows } = await runQuery(fastify.pg, getGameByChannel, [channel]);
      return rows;
    }
  );

  fastify.post(
    '/api/games',
    async (
      request: FastifyRequest<{
        Body: GameState;
      }>,
      reply: FastifyReply
    ) => {
      const { channel, gameMode, players } = request.body;

      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');

        // Create the game
        const gameResult = await client.query(createGame, [channel, gameMode]);
        const gameId = gameResult.rows[0].id;

        // Insert players
        const playerPromises = players.map((player) =>
          client.query(insertPlayer, [
            gameId,
            player.username || null,
            player.role,
            player.position,
            player.taxiTickets,
            player.busTickets,
            player.undergroundTickets,
            player.secretTickets || 0,
            player.doubleTickets || 0,
          ])
        );
        await Promise.all(playerPromises);

        await client.query('COMMIT');
        reply.code(201).send({ success: true, gameId });
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        reply.code(500).send({ success: false, error: 'Failed to save game' });
      } finally {
        client.release();
      }
    }
  );

  // Update a game
  fastify.put(
    '/api/games/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: Partial<GameState>;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { channel, gameMode } = request.body;

      try {
        await runQuery(fastify.pg, updateGame, [channel, gameMode, id]);
        reply.code(200).send({ success: true });
      } catch (error) {
        console.error(error);
        reply
          .code(500)
          .send({ success: false, error: 'Failed to update game' });
      }
    }
  );

  // Update a player
  fastify.patch(
    '/api/players/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: Partial<{
          username: string;
          role: string;
          position: number;
          taxiTickets: number;
          busTickets: number;
          undergroundTickets: number;
          secretTickets: number;
          doubleTickets: number;
        }>;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const body = request.body;

      // Build dynamic SQL query
      const fields = Object.keys(body);
      if (fields.length === 0) {
        reply.code(400).send({ success: false, error: 'No fields to update' });
        return;
      }

      const setClause = fields
        .map((field, index) => `${field} = $${index + 1}`)
        .join(', ');
      const values = Object.values(body);

      const query = `
        UPDATE players
        SET ${setClause}
        WHERE id = $${fields.length + 1};
      `;

      try {
        await runQuery(fastify.pg, query, [...values, id]);
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
  fastify.post(
    '/api/moves', 
    async (
      request: FastifyRequest<{
        Body: {
          gameId: number;
          role: string;
          move_type: string;
          isSecret: boolean;
          isDouble: boolean;
          position: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { gameId, role, move_type, isSecret, isDouble, position } =
        request.body;

      try {
        // Explicitly map camelCase properties to snake_case before inserting into the database
        const mappedMove = {
          game_id: gameId, // map gameId to game_id
          role: role,
          move_type: move_type,
          is_secret: isSecret, // map isSecret to is_secret
          is_double: isDouble, // map isDouble to is_double
          position: position,
        };

        await runQuery(fastify.pg, insertMove, [
          mappedMove.game_id,
          mappedMove.role,
          mappedMove.move_type,
          mappedMove.is_secret,
          mappedMove.is_double,
          mappedMove.position,
        ]);
        reply.code(201).send({ success: true });
      } catch (error) {
        console.error(error);
        reply.code(500).send({ success: false, error: 'Failed to add move' });
      }
    }
  );
}
