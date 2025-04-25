/* eslint-disable @typescript-eslint/no-explicit-any */
import { GameState, IpInfo, Move } from '@yard/shared-utils';
import { FastifyInstance } from 'fastify';
import { createGameState } from '../helpers/create-game';
import {
  pgTable,
  serial,
  varchar,
  jsonb,
  integer,
  boolean,
  timestamp,
  char,
  point,
} from 'drizzle-orm/pg-core';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(process.env.DATABASE_URL, {
  casing: 'snake_case',
});

export const gamesTable = pgTable('games', {
  id: serial('id').primaryKey(),
  channel: varchar('channel', { length: 255 }).notNull().unique(),
  players: jsonb('players').notNull(),
  currentTurn: varchar('current_turn', { length: 255 }).notNull(),
  moves: jsonb('moves').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
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
  previousPosition: integer('previous_position'),
  taxiTickets: integer('taxi_tickets').default(0),
  busTickets: integer('bus_tickets').default(0),
  undergroundTickets: integer('underground_tickets').default(0),
  secretTickets: integer('secret_tickets').default(0),
  doubleTickets: integer('double_tickets').default(0),
  isAI: boolean('is_ai').default(false),
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

export const ipInfoTable = pgTable('ip_info', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 45 }).notNull(),
  city: varchar('city', { length: 100 }),
  region: varchar('region', { length: 100 }),
  country: char('country', { length: 2 }),
  loc: point('loc'),
  org: varchar('org', { length: 255 }),
  postal: varchar('postal', { length: 20 }),
  timezone: varchar('timezone', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export async function hasActiveGame(channel: string): Promise<GameState | null> {
  console.log(`hasActiveGame called with channel: ${channel}`);

  try {
    const [game] = await db
      .select()
      .from(gamesTable)
      .where(
        eq(gamesTable.channel, channel)
      )
    .execute() as GameState[];

    // console.log(`Game fetched:`, game);

    if (!game) {
      console.log('No active game found for the given channel.');
      return null;
    }

    const players = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.gameId, game.id))
    .execute() as GameState['players'];

    // console.log(`Players fetched for game ${game.id}:`, players);

    const moves = await db
      .select()
      .from(movesTable)
      .where(eq(movesTable.gameId, game.id))
      .execute() as GameState['moves'];

    // console.log(`Moves fetched for game ${game.id}:`, moves);

    return { ...game, players, moves };
  } catch (error) {
    console.error('Error fetching active game:', error);
    return null;
  }
}

export async function addMove(gameId: number, role: string, type: string, position: number, secret = false, double = false) {
  // console.log(`Adding move: gameId=${gameId}, role=${role}, type=${type}, position=${position}, secret=${secret}, double=${double}`);

  try {
    await db.transaction(async (trx) => {
      // Add the move
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

      // Update player tickets
      await trx
        .update(playersTable)
        .set({
          taxiTickets: sql`${playersTable.taxiTickets} - ${type === 'taxi' ? 1 : 0}`,
          busTickets: sql`${playersTable.busTickets} - ${type === 'bus' ? 1 : 0}`,
          undergroundTickets: sql`${playersTable.undergroundTickets} - ${type === 'underground' ? 1 : 0}`,
          secretTickets: sql`${playersTable.secretTickets} - ${secret ? 1 : 0}`,
          doubleTickets: sql`${playersTable.doubleTickets} - ${double ? 1 : 0}`,
          position,
          previousPosition: sql`${playersTable.position}`,
        } as any)
        .where(
          sql`${playersTable.gameId} = ${gameId} AND ${playersTable.role} = ${role}`
        )
        .execute();
    });
  } catch (error) {
    console.error('Failed to add move:', error);
    throw new Error('Failed to add move');
  }
}

export async function updateGame(gameId: number, updates: Partial<GameState>) {
  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update');
  }

  try {
    await db.update(gamesTable).set(updates).where(eq(gamesTable.id, gameId));

    const [updatedGame] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .execute();

    return updatedGame;
  } catch (error) {
    console.error('Failed to update game:', error);
    throw new Error('Failed to update game');
  }
}

export default async function (fastify: FastifyInstance) {
  fastify.get<{ Params: { channel: string } }>(
    '/api/games/:channel',
    async (request, reply) => {
      try {
        const game = await db
          .select()
          .from(gamesTable)
          .where(eq(gamesTable.channel, request.params.channel))
          .execute();
        if (game.length === 0)
          return reply
            .code(404)
            .send({ success: false, error: 'Game not found' });

        const players = await db
          .select()
          .from(playersTable)
          .where(eq(playersTable.gameId, game[0].id))
          .execute();
        const moves = await db
          .select()
          .from(movesTable)
          .where(eq(movesTable.gameId, game[0].id))
          .execute();
        reply.send({ ...game[0], players, moves });
      } catch (error) {
        console.error(error);
        reply
          .code(500)
          .send({ success: false, error: 'Failed to fetch game data' });
      }
    }
  );

  // Create New Game
  fastify.post('/api/games', async (request, reply) => {
    const { channel, players, currentTurn } = createGameState();
    try {
      await db.transaction(async (trx) => {
        const [game] = await trx
          .insert(gamesTable)
          .values({
            channel,
            currentTurn,
            players: [],
            moves: [],
            status: 'active',
          })
          .returning()
          .execute();

        const gameId = game.id;

        await trx
          .insert(playersTable)
          .values(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            players.map(({ id, ...player }) => ({
              gameId,
              ...player,
            }))
          )
          .execute();

        const insertedPlayers = await trx
          .select()
          .from(playersTable)
          .where(eq(playersTable.gameId, gameId))
          .execute();

        reply.code(201).send({
          success: true,
          createdGame: { ...game, players: insertedPlayers },
        });
      });
    } catch (error) {
      console.error(error);
      reply.code(500).send({ success: false, error: 'Failed to save game' });
    }
  });

  // Update a game
  fastify.patch<{ Params: { id: string } }>(
    '/api/games/:id',
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
    '/api/players/:id',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body;

      if (Object.keys(body).length === 0) {
        return reply
          .code(400)
          .send({ success: false, error: 'No fields to update' });
      }

      try {
        await db
          .update(playersTable)
          .set(body)
          .where(eq(playersTable.id, id))
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
  fastify.post<{ Body: Move }>('/api/moves', async (request, reply) => {
    const {
      gameId,
      role,
      type,
      secret = false,
      double = false,
      position,
    } = request.body;

    try {
      await addMove(gameId, role, type, position, secret, double);

      // Get updated game state
      const [updatedGame] = await db
        .select()
        .from(gamesTable)
        .where(eq(gamesTable.id, gameId))
        .execute();

      reply.code(201).send({ success: true, updatedGame });
    } catch (error) {
      console.error('Failed to add move:', error);
      reply.code(500).send({ success: false, error: 'Failed to add move' });
    }
  });

  fastify.post<{ Body: IpInfo }>('/api/ip-info', async (request, reply) => {
    const { username, city, region, country, loc, org, postal, timezone } = request.body;
    const records = await db.select().from(ipInfoTable).where(eq(ipInfoTable.postal, postal));
    if (records.length > 0) {
      return reply.code(205).send();
    }
    try {
      const [ipInfo] = await db.transaction(async (trx) => {
        return await trx.insert(ipInfoTable).values({
          username,
          city,
          region,
          country,
          loc,
          org,
          postal,
          timezone,
        } as any).returning();
      });

      return reply.code(201).send(ipInfo);
    } catch (error) {
      console.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
