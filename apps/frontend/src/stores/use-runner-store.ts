import {create} from 'zustand';
import { Move, MoveType, RoleType } from '@yard/shared-utils';

export interface RunnerState {
    currentPosition: number;
    currentType: MoveType;
    currentRole?: RoleType;
    isSecret: boolean;
    isDouble: boolean;
    secretTickets: number;
    doubleTickets: number;
    move: Move | null;
isMagnifyEnabled: boolean;
setIsMagnifyEnabled: (isMagnifyEnabled: boolean) => void;
    setMove: (move: Move | null) => void;
    updateSecretTickets: (secretTickets: number) => void;
    updateDoubleTickets: (doubleTickets: number) => void;
    setCurrentPosition: (currentPosition: number) => void;
    setCurrentType: (currentType: MoveType | undefined) => void;
    setCurrentRole: (role: RoleType) => void;
    setIsSecret: (isSecret: boolean) => void;
    setIsDouble: (isDouble: boolean) => void;
}

export const useRunnerStore = create<RunnerState>((set) => ({
    currentPosition: 0,
    currentType: 'taxi',
    currentRole: undefined,
    isSecret: false,
    isDouble: false,
    secretTickets: 5,
    doubleTickets: 2,
    move: null,
    isMagnifyEnabled: false,
    setIsMagnifyEnabled: (isMagnifyEnabled) => set({ isMagnifyEnabled }),
    setMove: (move) => set({ move }),
    updateSecretTickets: (secretTickets: number) => set({ secretTickets }),
    updateDoubleTickets: (doubleTickets: number) => set({ doubleTickets }),
    setCurrentPosition: (currentPosition: number) => set({ currentPosition }),
    setCurrentType: (currentType: MoveType | undefined) => {
        set({ currentType });
    },
    setCurrentRole: (role) => set({currentRole: role}),
    setIsSecret: (isSecret) => set({ isSecret }),
    setIsDouble: (isDouble) => set({ isDouble }),
}));
