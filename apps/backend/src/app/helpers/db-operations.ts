import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { gamesTable, playersTable, movesTable } from '../helpers/pg-tables';
import { GameState } from '@yard/shared-utils';

const db = drizzle(process.env.DATABASE_URL, {
  casing: 'snake_case',
});

export async function hasActiveGame(channel: string): Promise<GameState | null> {
  try {
    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.channel, channel))
      .execute() as GameState[];

    if (!game) {
      return null;
    }

    const players = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.gameId, game.id))
      .execute() as GameState['players'];

    const moves = await db
      .select()
      .from(movesTable)
      .where(eq(movesTable.gameId, game.id))
      .execute() as GameState['moves'];

    return { ...game, players, moves };
  } catch (error) {
    console.error('Error fetching active game:', error);
    return null;
  }
}

export async function addMove(gameId: number, role: string, type: string, position: number, secret = false, double = false) {
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
        .where(sql`${playersTable.gameId} = ${gameId} AND ${playersTable.role} = ${role}`)
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
