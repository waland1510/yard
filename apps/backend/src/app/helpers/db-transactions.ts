import { IpInfo, Move, Player } from '@yard/shared-utils';
import { asc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { gamesTable, ipInfoTable, movesTable, playersTable } from '../helpers/pg-tables';
import { ENV } from './env';

const db = drizzle(ENV.DATABASE_URL, {
  casing: 'snake_case',
});

export async function createGame(channel: string, players: Player[], currentTurn: string, theme = 'classic') {
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
          theme,
        })
        .returning()
        .execute();

      const gameId = game.id;

      await trx
        .insert(playersTable)
        .values(
          players.map((player) => ({
            ...player,
            id: undefined,
            gameId,
          }))
        )
        .execute();

      const insertedPlayers = await trx
        .select()
        .from(playersTable)
        .where(eq(playersTable.gameId, gameId))
        .orderBy(asc(playersTable.id))
        .execute();

      return { ...game, players: insertedPlayers };
    });
  } catch (error) {
    console.error('Failed to create game:', error);
    throw new Error('Failed to create game');
  }
}

export async function updatePlayer(id: number, updates: Partial<typeof playersTable.$inferInsert>) {
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
  if (gameId == null || role == null) throw new Error('addMove requires gameId and role');
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
        })
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
        })
        .where(sql`${playersTable.gameId} = ${gameId} AND ${playersTable.role} = ${role}`)
        .execute();
    });
  } catch (error) {
    console.error('Failed to add move:', error);
    throw new Error('Failed to add move');
  }
}

export async function saveIpInfo(
  ipInfo: Omit<IpInfo, 'id' | 'createdAt'> & Partial<Pick<IpInfo, 'id' | 'createdAt'>>
) {
  const { postal  } = ipInfo;
  try {
    const records = await db.select().from(ipInfoTable).where(eq(ipInfoTable.postal, postal));
    if (records.length > 0) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, loc, ...ipInfoValues } = ipInfo;

    // `loc` is a Postgres point column: accept either "lat,lng" or an already-parsed tuple.
    const coords = (Array.isArray(loc) ? loc : String(loc).split(',').map(Number)) as [
      number,
      number
    ];

    const [savedIpInfo] = await db.transaction(async (trx) => {
      return await trx
        .insert(ipInfoTable)
        .values({ ...ipInfoValues, loc: coords })
        .returning();
    });

    return savedIpInfo;
  } catch (error) {
    console.error('Failed to save IP info:', error);
    throw new Error('Failed to save IP info');
  }
}
