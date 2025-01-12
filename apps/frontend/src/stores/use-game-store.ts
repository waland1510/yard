import { create } from 'zustand';
import { initialPlayers, Player, GameMode, Role, RoleType, Move, GameState } from '@yard/shared-utils';

export interface ClientGameState extends GameState {
  updateMoves: (move: Move) => void;
  setMovesCount: (movesCount: number) => void;
  setCurrentTurn: (currentTurn: RoleType) => void;
  setPlayer: (player: Player) => void;
  setGameMode: (gameMode?: GameMode) => void;
  setChannel: (channel?: string) => void;
  setTaxiTickets: (playerId: number, taxiTickets: number) => void;
  setBusTickets: (playerId: number, busTickets: number) => void;
  setUndergroundTickets: (playerId: number, undergroundTickets: number) => void;
  setSecretTickets: (secretTickets: number) => void;
  setDoubleTickets: (doubleTickets: number) => void;
  setPosition: (playerRole: string, position: number | string) => void;
}

export const useGameStore = create<ClientGameState>((set) => ({
  moves: [],
  updateMoves: (move) => set((state) => ({ moves: [...(state.moves || []), move] })),
  movesCount: 0,
  setMovesCount: (movesCount) => set({ movesCount }),
  currentTurn: Role.culprit,
  setCurrentTurn: (currentTurn) => set({ currentTurn }),
  players: initialPlayers,
  setPlayer: (player) =>
    set((state) => {
      const existingPlayer = state.players.find((p) => p.id === player.id);
      if (existingPlayer) {
        existingPlayer.role = player.role;
        existingPlayer.username = player.username;
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
  channel: '',
  setChannel: (channel?: string) => set({ channel }),
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
