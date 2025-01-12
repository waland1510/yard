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
  channel: string;
  gameMode?: GameMode;
  players: Player[];
  currentTurn: RoleType;
  moves: Move[];
  movesCount: number;
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
  role?: RoleType;
  type: string;
  isSecret?: boolean;
  isDouble?: boolean;
  position: number;
}

export type MessageType = 'startGame' | 'joinGame' | 'makeMove' | 'updateGameState';

export interface Message {
  type: MessageType;
  channel?: string;
  data: any;
}

export const showCulpritAtMoves = [3, 8, 13, 18];

