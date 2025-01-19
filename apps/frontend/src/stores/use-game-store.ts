import { create } from 'zustand';
import {
  initialPlayers,
  Player,
  GameMode,
  Role,
  RoleType,
  Move,
  GameState,
  MoveType,
} from '@yard/shared-utils';

export interface ClientGameState extends GameState {
  updateMoves: (move: Move) => void;
  setMovesCount: (movesCount: number) => void;
  setCurrentTurn: (currentTurn: RoleType) => void;
  setPlayer: (player: Player) => void;
  updatePlayer: (role: string, username: string) => void;
  setGameMode: (gameMode?: GameMode) => void;
  setChannel: (channel?: string) => void;
  updateTicketsCount: (
    playerRole: string,
    type: MoveType,
    isSecret: boolean,
    isDouble: boolean
  ) => void;
  setPosition: (playerRole: string, position: number | string) => void;
  setIsDoubleMove: (isDoubleMove: boolean) => void;
}

export const useGameStore = create<ClientGameState>((set, get) => ({
  moves: [],
  status: 'active',
  updateMoves: (move) =>
    set((state) => ({ moves: [...(state.moves || []), move] })),
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
  updatePlayer: (role, username) =>
    set((state) => {
      const player = state.players.find((p) => p.role === role);
      if (player) {
        player.username = username;
      }
      return { players: state.players };
    }),
  gameMode: undefined,
  setGameMode: (gameMode?: GameMode) => set({ gameMode }),
  channel: '',
  setChannel: (channel?: string) => {
    console.log('setChannel', channel);
    if (channel) set({ channel });
  },
  updateTicketsCount: (
    playerRole: string,
    type: MoveType,
    isSecret: boolean,
    isDouble: boolean
  ) =>
    set((state) => {
      const player = state.players.find((p) => p.role === playerRole);
      if (!player) return state;
      if (isDouble) {
        if (player.doubleTickets !== undefined) {
          player.doubleTickets = player.doubleTickets - 1;
        }
      }
      if (isSecret) {
        if (player.secretTickets !== undefined) {
          player.secretTickets = player.secretTickets - 1;
        }
      } else {
        switch (type) {
          case 'taxi':
            player.taxiTickets = player.taxiTickets - 1;
            break;
          case 'bus':
            player.busTickets = player.busTickets - 1;
            break;
          case 'underground':
            player.undergroundTickets = player.undergroundTickets - 1;
            break;
          default:
            break;
        }
      }
      return { players: state.players };
    }),
  setPosition: (playerRole: string, position: number | string) =>
    set((state) => {
      const player = state.players.find((p) => p.role === playerRole);
      if (!player) return state;
      player.position = Number(position);
      return { players: state.players };
    }),
  isDoubleMove: false,
  setIsDoubleMove: (isDoubleMove) => set({ isDoubleMove }),
}));
