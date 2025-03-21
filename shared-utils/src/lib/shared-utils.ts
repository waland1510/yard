import { PostgresDb } from '@fastify/postgres';

export const Role = {
  culprit: 'culprit',
  detective1: 'detective1',
  detective2: 'detective2',
  detective3: 'detective3',
  detective4: 'detective4',
  detective5: 'detective5',
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export type Status = 'active' | 'finished';

export interface GameState {
  id?: number;
  channel: string;
  players: Player[];
  currentTurn: RoleType;
  moves: Move[];
  isDoubleMove: boolean;
  status: Status;
}

export interface Player {
  id: number;
  username?: string;
  role: RoleType;
  position: number;
  previousPosition?: number;
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
    previousPosition: 1,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 2,
    role: 'detective2',
    position: 20,
    previousPosition: 2,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 3,
    role: 'detective3',
    position: 30,
    previousPosition: 3,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 4,
    role: 'detective4',
    position: 40,
    previousPosition: 4,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 5,
    role: 'detective5',
    position: 50,
    previousPosition: 5,
    taxiTickets: 10,
    busTickets: 8,
    undergroundTickets: 4,
  },
  {
    id: 6,
    role: 'culprit',
    position: 60,
    previousPosition: 6,
    taxiTickets: 24,
    busTickets: 24,
    undergroundTickets: 24,
    secretTickets: 5,
    doubleTickets: 2,
  },
];

export interface Move {
  gameId?: number;
  role?: RoleType;
  type: MoveType;
  secret?: boolean;
  double?: boolean;
  position: number;
}

export type MoveType = 'taxi' | 'bus' | 'underground' | 'river';

export type MessageType =
  | 'startGame'
  | 'joinGame'
  | 'makeMove'
  | 'updateGameState'
  | 'impersonate'
  | 'endGame';

export interface Message {
  type: MessageType;
  channel?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export const showCulpritAtMoves = [3, 8, 13, 18, 24];

export function getNextRole(
  currentRole: RoleType,
  isDouble: boolean
): RoleType {
  if (isDouble) {
    return currentRole;
  }
  const roles = Object.values(Role) as RoleType[];
  const currentIndex = roles.indexOf(currentRole);
  return roles[(currentIndex + 1) % roles.length];
}

export interface IpInfo {
  id: number;
  username: string;
  city: string;
  region: string;
  country: string;
  loc: string;
  org: string;
  postal: string;
  timezone: string;
  createdAt: string;
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
