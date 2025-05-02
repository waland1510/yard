import { pgTable, serial, varchar, jsonb, integer, boolean, timestamp, char, point } from 'drizzle-orm/pg-core';

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
