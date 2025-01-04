import { create } from 'zustand';

export type Role =
  | 'detective1'
  | 'detective2'
  | 'detective3'
  | 'detective4'
  | 'detective5'
  | 'culprit';

export type GameMode = 'easy' | 'medium' | 'hard';
export interface Player {
  id: number;
  role: Role;
  position: number;
  taxiTickets: number;
  busTickets: number;
  undergroundTickets: number;
  secretTickets?: number;
  doubleTickets?: number;
}

export interface GameState {
  players: Player[];
  setPlayer: (player: Player) => void;
  gameMode?: GameMode;
  setGameMode: (gameMode?: GameMode) => void;
  move: (playerId: number, target: number) => void;
  setTaxiTickets: (playerId: number, taxiTickets: number) => void;
  setBusTickets: (playerId: number, busTickets: number) => void;
  setUndergroundTickets: (playerId: number, undergroundTickets: number) => void;
  setSecretTickets: (secretTickets: number) => void;
  setDoubleTickets: (doubleTickets: number) => void;
  setPosition: (playerRole: string, position: number | string) => void;
}

const initialPlayers: Player[] = [
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

export const useGameStore = create<GameState>((set) => ({
  players: initialPlayers,
  setPlayer: (player) =>
    set((state) => {
      const existingPlayer = state.players.find((p) => p.id === player.id);
      if (existingPlayer) {
        existingPlayer.position = player.position;
        existingPlayer.taxiTickets = player.taxiTickets;
        existingPlayer.busTickets = player.busTickets;
        existingPlayer.undergroundTickets = player.undergroundTickets;
        existingPlayer.secretTickets = player.secretTickets;
        existingPlayer.doubleTickets = player.doubleTickets;
      } else {
        state.players.push(player);
      }
      return { players: state.players };
    }),
  gameMode: undefined,
  setGameMode: (gameMode?: GameMode) => set({ gameMode }),
  move: (playerId: number, target: number) =>
    set((state) => {
      const player = state.players.find((p) => p.id === playerId);
      if (!player) return state;
      player.position = target;
      return { players: state.players };
    }),
  setTaxiTickets: (playerId: number, taxiTickets: number) =>
    set((state) => {
      const player = state.players.find((p) => p.id === playerId);
      if (!player) return state;
      player.taxiTickets = taxiTickets;
      return { players: state.players };
    }),
  setBusTickets: (playerId: number, busTickets: number) =>
    set((state) => {
      const player = state.players.find((p) => p.id === playerId);
      if (!player) return state;
      player.busTickets = busTickets;
      return { players: state.players };
    }),
  setUndergroundTickets: (playerId: number, undergroundTickets: number) =>
    set((state) => {
      const player = state.players.find((p) => p.id === playerId);
      if (!player) return state;
      player.undergroundTickets = undergroundTickets;
      return { players: state.players };
    }),
  setSecretTickets: (secretTickets: number) =>
    set((state) => {
      const culprit = state.players.find((p) => p.role === 'culprit');
      if (culprit) culprit.secretTickets = secretTickets;
      return { players: state.players };
    }),
  setDoubleTickets: (doubleTickets: number) =>
    set((state) => {
      const culprit = state.players.find((p) => p.role === 'culprit');
      if (culprit) culprit.doubleTickets = doubleTickets;
      return { players: state.players };
    }),
  setPosition: (playerRole: string, position: number | string) =>
    set((state) => {
      const player = state.players.find((p) => p.role === playerRole);
      if (!player) return state;
      player.position = Number(position);
      return { players: state.players };
    }),
}));
