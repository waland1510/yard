import { PostgresDb } from '@fastify/postgres';

export const Role = {
  culprit: 'culprit',
  detective1: 'detective1',
  detective2: 'detective2',
  detective3: 'detective3',
  detective4: 'detective4',
  detective5: 'detective5',
} as const;

export type RoleType = typeof Role[keyof typeof Role];

export type GameMode = 'easy' | 'medium' | 'hard';

export interface GameState {
  id? : number;
  channel: string;
  gameMode?: GameMode;
  players: Player[];
  currentTurn: RoleType;
  moves: Move[];
  movesCount: number;
  isDoubleMove: boolean;
  status: 'active' | 'finished';
}

export interface Player {
  id: number;
  username?: string;
  role: RoleType;
  position: number;
  taxiTickets: number;
  busTickets: number;
  undergroundTickets: number;
  secretTickets?: number;
  doubleTickets?: number;
}

export const initialPlayers: Player[] = [
  {
    id: 1,
    role: 'detective1',
    position: 10,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 2,
    role: 'detective2',
    position: 20,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 3,
    role: 'detective3',
    position: 30,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 4,
    role: 'detective4',
    position: 40,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 5,
    role: 'detective5',
    position: 50,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 6,
    role: 'culprit',
    position: 60,
    taxiTickets: 24,
    busTickets: 24,
    undergroundTickets: 24,
    secretTickets: 5,
    doubleTickets: 2,
  },
];

export interface Move {
  gameId: number;
  role?: RoleType;
  type: MoveType;
  secret?: boolean;
  double?: boolean;
  position: number;
}

export type MoveType = 'taxi' | 'bus' | 'underground' | 'river';

export type MessageType = 'startGame' | 'joinGame' | 'makeMove' | 'updateGameState' | 'impersonate' | 'endGame';

export interface Message {
  type: MessageType;
  channel?: string;
  data: any;
}

export const showCulpritAtMoves = [3, 8, 13, 18];

export function getNextRole(currentRole: RoleType, isDouble: boolean): RoleType {
  if (isDouble) {
    return currentRole;
  }
  const roles = Object.values(Role) as RoleType[];
  const currentIndex = roles.indexOf(currentRole);
  return roles[(currentIndex + 1) % roles.length];
}

export const RESET_DB = `DROP TABLE IF EXISTS users, posts CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
`;

export async function resetDb(pg: PostgresDb) {
  await runQuery(pg, RESET_DB);
  return 'Ok';
}

export async function runQuery(
  pg: PostgresDb,
  query: string,
  params: unknown[] = []
) {
  const client = await pg.connect();
  try {
    return await client.query(query, params);
  } finally {
    client.release();
  }
}

export const easyPositions = [
  {
    culprit: 127,
    detective1: 53, // blue
    detective2: 26, // green
    detective3: 141, // red
    detective4: 29, // yellow
    detective5: 117, // black
  },
  {
    culprit: 127,
    detective1: 117, // blue
    detective2: 94, // green
    detective3: 103, // red
    detective4: 34, // yellow
    detective5: 50, // black
  },
  {
    culprit: 127,
    detective1: 26, // blue
    detective2: 53, // green
    detective3: 141, // red
    detective4: 117, // yellow
    detective5: 29, // black
  },
  {
    culprit: 170,
    detective1: 91, // blue
    detective2: 36, // green
    detective3: 147, // red
    detective4: 13, // yellow
    detective5: 108, // black
  },
  {
    culprit: 111,
    detective1: 94, // blue
    detective2: 32, // green
    detective3: 135, // red
    detective4: 105, // yellow
    detective5: 47, // black
  },
  {
    culprit: 51,
    detective1: 141, // blue
    detective2: 103, // green
    detective3: 53, // red
    detective4: 13, // yellow
    detective5: 29, // black
  },
];

export const mediumPositions = [
  {
    culprit: 172,
    detective1: 91, // blue
    detective2: 34, // green
    detective3: 112, // red
    detective4: 13, // yellow
    detective5: 108, // black
  },
  {
    culprit: 103,
    detective1: 26, // blue
    detective2: 82, // green
    detective3: 147, // red
    detective4: 63, // yellow
    detective5: 50, // black
  },
  {
    culprit: 78,
    detective1: 88, // blue
    detective2: 42, // green
    detective3: 111, // red
    detective4: 31, // yellow
    detective5: 99, // black
  },
];

export const hardPositions = [
  {
    culprit: 96,
    detective1: 53, // blue
    detective2: 26, // green
    detective3: 132, // red
    detective4: 112, // yellow
    detective5: 117, // black
  },
  {
    culprit: 73,
    detective1: 128, // blue
    detective2: 100, // green
    detective3: 42, // red
    detective4: 94, // yellow
    detective5: 157, // black
  },
  {
    culprit: 45,
    detective1: 111, // blue
    detective2: 135, // green
    detective3: 53, // red
    detective4: 24, // yellow
    detective5: 66, // black
  },
  {
    culprit: 59,
    detective1: 74, // blue
    detective2: 33, // green
    detective3: 116, // red
    detective4: 82, // yellow
    detective5: 103, // black
  },
];
