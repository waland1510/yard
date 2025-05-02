import { IpInfo, Move } from '@yard/shared-utils';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { gamesTable, ipInfoTable, movesTable, playersTable } from '../helpers/pg-tables';
import { ENV } from './env';

const db = drizzle(ENV.DATABASE_URL, {
  casing: 'snake_case',
});

export async function createGame(channel: string, players: any[], currentTurn: string) {
  try {
    return await db.transaction(async (trx) => {
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

      return { ...game, players: insertedPlayers };
    });
  } catch (error) {
    console.error('Failed to create game:', error);
    throw new Error('Failed to create game');
  }
}

export async function updatePlayer(id: number, updates: Partial<any>) {
  try {
    await db
      .update(playersTable)
      .set(updates)
      .where(eq(playersTable.id, id))
      .execute();
  } catch (error) {
    console.error('Failed to update player:', error);
    throw new Error('Failed to update player');
  }
}

export async function addMove(move: Move) {
  const { gameId, role, type, position, secret = false, double = false } = move;
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

export async function saveIpInfo(ipInfo: IpInfo) {
  const { postal  } = ipInfo;
  try {
    const records = await db.select().from(ipInfoTable).where(eq(ipInfoTable.postal, postal));
    if (records.length > 0) {
      return null;
    }

    const [savedIpInfo] = await db.transaction(async (trx) => {
      return await trx
        .insert(ipInfoTable)
        .values({...ipInfo})
        .returning();
    });

    return savedIpInfo;
  } catch (error) {
    console.error('Failed to save IP info:', error);
    throw new Error('Failed to save IP info');
  }
}
