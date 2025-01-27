import { GameState, GameMode, Player, Move } from '@yard/shared-utils';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createGameState } from '../helpers/create-game';
import {
  pgTable,
  serial,
  varchar,
  jsonb,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

export const gamesTable = pgTable('games', {
  id: serial('id').primaryKey(),
  channel: varchar('channel', { length: 255 }).notNull().unique(),
  gameMode: varchar('game_mode', { length: 255 }).notNull(),
  players: jsonb('players').notNull(),
  currentTurn: varchar('current_turn', { length: 255 }).notNull(),
  moves: jsonb('moves').notNull(),
  movesCount: integer('moves_count').default(0),
  isDoubleMove: boolean('is_double_move').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const playersTable = pgTable('players', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id')
    .notNull()
    .references(() => gamesTable.id, { onDelete: 'cascade' }),
  username: varchar('username', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull(),
  position: integer('position').notNull(),
  taxiTickets: integer('taxi_tickets').default(0),
  busTickets: integer('bus_tickets').default(0),
  undergroundTickets: integer('underground_tickets').default(0),
  secretTickets: integer('secret_tickets').default(0),
  doubleTickets: integer('double_tickets').default(0),
});

export const movesTable = pgTable('moves', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id')
    .notNull()
    .references(() => gamesTable.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  secret: boolean('secret').default(false),
  double: boolean('double').default(false),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export default async function (fastify: FastifyInstance) {
  const db = drizzle(process.env.DATABASE_URL);

  fastify.get(
    '/api/games/:channel',
    async (
      request: FastifyRequest<{ Params: { channel: string } }>,
      reply: FastifyReply
    ) => {
      const { channel } = request.params;

      try {
        // Fetch the main game details
        const game = await db
          .select()
          .from(gamesTable)
          .where(eq(gamesTable.channel, channel))
          .execute();

        if (game.length === 0) {
          reply.code(404).send({ success: false, error: 'Game not found' });
          return;
        }
        console.log({ game });

        const gameData = game[0];
        console.log({ gameData });

        // Fetch players associated with the game
        const players = await db
          .select()
          .from(playersTable)
          .where(eq(playersTable.gameId, gameData.id))
          .execute();
        console.log(players);

        // Fetch moves associated with the game
        const moves = await db
          .select()
          .from(movesTable)
          .where(eq(movesTable.gameId, gameData.id))
          .execute();

        // Combine data
        const response = {
          ...gameData,
          players,
          moves,
        };

        reply.send(response);
      } catch (error) {
        console.error(error);
        reply
          .code(500)
          .send({ success: false, error: 'Failed to fetch game data' });
      }
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
      const { channel, players, gameMode, currentTurn } = createGameState(
        request.body
      );

      try {
        await db.transaction(async (trx) => {
          // Save the game to the database
          const [game] = await trx
            .insert(gamesTable)
            .values({
              channel,
              gameMode,
              currentTurn,
              players: [],
              moves: [],
            })
            .returning({
              id: gamesTable.id,
              channel: gamesTable.channel,
              gameMode: gamesTable.gameMode,
              currentTurn: gamesTable.currentTurn,
              movesCount: gamesTable.movesCount,
              isDoubleMove: gamesTable.isDoubleMove,
              createdAt: gamesTable.createdAt,
              updatedAt: gamesTable.updatedAt,
            })
            .execute();
          const gameId: number = game.id;

          // Insert players into the database
          await trx
            .insert(playersTable)
            .values(
              players.map((player) => ({
                gameId,
                username: player.username || null,
                role: player.role,
                position: player.position,
                taxiTickets: player.taxiTickets,
                busTickets: player.busTickets,
                undergroundTickets: player.undergroundTickets,
                secretTickets: player.secretTickets || 0,
                doubleTickets: player.doubleTickets || 0,
              }))
            )
            .execute();

          // Fetch the players associated with the created game
          const fetchedPlayers = await trx
            .select({
              id: playersTable.id,
              gameId: playersTable.gameId,
              username: playersTable.username,
              role: playersTable.role,
              position: playersTable.position,
              taxiTickets: playersTable.taxiTickets,
              busTickets: playersTable.busTickets,
              undergroundTickets: playersTable.undergroundTickets,
              secretTickets: playersTable.secretTickets,
              doubleTickets: playersTable.doubleTickets,
            })
            .from(playersTable)
            .where(eq(playersTable.gameId, gameId))
            .execute();

          // Combine game and players into the response
          const createdGameWithPlayers = {
            ...game,
            players: fetchedPlayers,
          };

          reply
            .code(201)
            .send({ success: true, createdGame: createdGameWithPlayers });
        });
      } catch (error) {
        console.error(error);
        reply.code(500).send({ success: false, error: 'Failed to save game' });
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
      const id = parseInt(request.params.id, 10);
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

      try {
        await db
          .update(gamesTable)
          .set(Object.fromEntries(validEntries))
          .where(eq(gamesTable.id, id))
          .execute();
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

      try {
        await db
          .update(playersTable)
          .set(body)
          .where(eq(playersTable.id, parseInt(id, 10)))
          .execute();
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
        Body: Partial<Move>;
      }>,
      reply: FastifyReply
    ) => {
      const {
        gameId,
        role,
        type,
        secret = false,
        double = false,
        position,
      } = request.body;

      try {
        await db.transaction(async (trx) => {
          await trx
            .insert(movesTable)
            .values({
              gameId,
              role,
              type,
              secret,
              double,
              position,
            } as any)
            .execute();

          // Increment movesCount in the games table
            // await trx
            //   .update(gamesTable)
            // .set({
            //   movesCount: gamesTable.movesCount.plus(1),
            // })
            // .where(eq(gamesTable.id, gameId))
            // .execute();

          // Fetch updated game data (if required for the response)
          const [updatedGame] = await trx
            .select({
              id: gamesTable.id,
              movesCount: gamesTable.movesCount,
              isDoubleMove: gamesTable.isDoubleMove,
              updatedAt: gamesTable.updatedAt,
            })
            .from(gamesTable)
            .where(eq(gamesTable.id, gameId))
            .execute();

          reply.code(201).send({ success: true, updatedGame });
        });
      } catch (error) {
        console.error('Failed to add move:', error);
        reply.code(500).send({ success: false, error: 'Failed to add move' });
      }
    }
  );
}
