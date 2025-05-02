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
}

export const useGameStore = create<ClientGameState>((set, get) => ({
  id: undefined,
  setId: (id) => set({ id }),
  moves: [],
  status: 'active',
  setStatus: (status) => set({ status }),
  updateMoves: (move) =>
    set((state) => ({
      moves: move ? [...state.moves, move] : state.moves,
    })),
  currentTurn: Role.culprit,
  setCurrentTurn: (currentTurn) => set({ currentTurn }),
  players: initialPlayers,
  setPlayer: (player) =>
    set((state) => {
      const updatedPlayers = state.players.map((p) =>
        p.id === player.id ? { ...p, ...player } : p
      );
      return { players: updatedPlayers };
    }),
  updatePlayer: (role, username) =>
    set((state) => {
      const updatedPlayers = state.players.map((p) =>
        p.role === role ? { ...p, username } : p
      );
      return { players: updatedPlayers };
    }),
  channel: '',
  setChannel: (channel) => set({ channel }),
  updateTicketsCount: (playerRole, type, isSecret, isDouble) =>
    set((state) => {
      const updatedPlayers = state.players.map((p) => {
        if (p.role !== playerRole) return p;
        const updatedPlayer = { ...p };
        if (isDouble) updatedPlayer.doubleTickets = (updatedPlayer.doubleTickets ?? 0) - 1;
        if (isSecret) updatedPlayer.secretTickets = (updatedPlayer.secretTickets ?? 0) - 1;
        if (!isSecret) {
          switch (type) {
            case 'taxi':
              updatedPlayer.taxiTickets -= 1;
              break;
            case 'bus':
              updatedPlayer.busTickets -= 1;
              break;
            case 'underground':
              updatedPlayer.undergroundTickets -= 1;
              break;
          }
        }
        return updatedPlayer;
      });
      return { players: updatedPlayers };
    }),
  setPosition: (playerRole, position) =>
    set((state) => {
      const updatedPlayers = state.players.map((p) =>
        p.role === playerRole
          ? { ...p, previousPosition: p.position, position: Number(position) }
          : p
      );
      return { players: updatedPlayers };
    }),
  isDoubleMove: false,
  setIsDoubleMove: (isDoubleMove) => set({ isDoubleMove }),
}));
