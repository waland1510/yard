import { runQuery, GameState, GameMode, Player } from '@yard/shared-utils';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createGameState } from "../helpers/create-game";

const getGameByChannel = `
  SELECT
    g.id,
    g.channel,
    g.current_turn AS "currentTurn",
    g.game_mode AS "gameMode",
    g.created_at,
    g.updated_at,
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

const createNewGame = `
  INSERT INTO games (channel, game_mode, current_turn, created_at, updated_at)
  VALUES ($1, $2, $3, NOW(), NOW())
  RETURNING id;
`;

const insertPlayer = `
  INSERT INTO players (game_id, username, role, position, taxi_tickets, bus_tickets, underground_tickets, secret_tickets, double_tickets)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
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
        Body: GameMode;
      }>,
      reply: FastifyReply
    ) => {
      // Create game state
      const {channel, players, gameMode, currentTurn}  = createGameState(request.body);

      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');

        // Save the game to the database
        const gameResult = await client.query(createNewGame, [channel, gameMode, currentTurn]);
        const gameId = gameResult.rows[0].id;

        // Insert players into the database
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
        const { rows } = await runQuery(fastify.pg, getGameByChannel, [channel]);
        reply.code(201).send({ success: true, createdGame: rows[0]});
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
fastify.patch(
  '/api/games/:id',
  async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: Partial<GameState>;
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const body = request.body;

    // Map body fields to database column names
    const mappedGame = {
      game_mode: body.gameMode,
      current_turn: body.currentTurn,
      moves_count: body.movesCount,
      is_double_move: body.isDoubleMove,
      status: body.status,
    };

    // Filter out undefined or null fields
    const validEntries = Object.entries(mappedGame).filter(
      ([_, value]) => value !== undefined
    );

    if (validEntries.length === 0) {
      reply.code(400).send({ success: false, error: 'No fields to update' });
      return;
    }

    // Build dynamic SQL query
    const setClause = validEntries
      .map(([key], index) => `${key} = $${index + 1}`)
      .join(', ');
    const values = validEntries.map(([_, value]) => value);

    const query = `
      UPDATE games
      SET ${setClause}
      WHERE id = $${validEntries.length + 1};
    `;

    try {
      await runQuery(fastify.pg, query, [...values, id]);
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
        Body: Partial<Player>;
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
