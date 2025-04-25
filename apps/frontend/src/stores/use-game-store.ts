import { create } from 'zustand';
import {
  initialPlayers,
  Player,
  Role,
  RoleType,
  Move,
  GameState,
  MoveType,
  Status,
} from '@yard/shared-utils';

export interface ClientGameState extends GameState {
  setId: (id: number) => void;
  setStatus: (status: Status) => void;
  updateMoves: (move?: Move) => void;
  setCurrentTurn: (currentTurn?: RoleType) => void;
  setPlayer: (player: Player) => void;
  updatePlayer: (role?: RoleType, username?: string) => void;
  setChannel: (channel?: string) => void;
  updateTicketsCount: (
    playerRole?: RoleType,
    type?: MoveType,
    isSecret?: boolean,
    isDouble?: boolean
  ) => void;
  setPosition: (playerRole: RoleType, position: number) => void;
  setIsDoubleMove: (isDoubleMove?: boolean) => void;
  getNextPlayer: () => Player | undefined;
}

export const useGameStore = create<ClientGameState>((set, get) => ({
  id: undefined,
  setId: (id) => set({ id }),
  moves: [],
  status: 'active',
  setStatus: (status) => set({ status }),
  updateMoves: (move) =>
    set((state) => ({
      moves: move ? [...(state.moves || []), move] : state.moves || [],
    })),
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
        existingPlayer.previousPosition = player.previousPosition;
        existingPlayer.taxiTickets = player.taxiTickets;
        existingPlayer.busTickets = player.busTickets;
        existingPlayer.undergroundTickets = player.undergroundTickets;
        existingPlayer.secretTickets = player.secretTickets;
        existingPlayer.doubleTickets = player.doubleTickets;
        existingPlayer.isAI = player.isAI;
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
  channel: '',
  setChannel: (channel?: string) => {
    if (channel) set({ channel });
  },
  updateTicketsCount: (
    playerRole?: string,
    type?: MoveType,
    isSecret?: boolean,
    isDouble?: boolean
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
  setPosition: (playerRole: RoleType, position: number | string) =>
    set((state) => {
      const player = state.players.find((p) => p.role === playerRole);
      if (!player) return state;
      player.previousPosition = player.position;
      player.position = Number(position);
      return { players: state.players };
    }),
  isDoubleMove: false,
  setIsDoubleMove: (isDoubleMove) => set({ isDoubleMove }),
  getNextPlayer: () => {
    const state = get();
    return state.players.find(p => p.role === state.currentTurn);
  }
}));
