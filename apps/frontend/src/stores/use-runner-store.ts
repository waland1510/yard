import {create} from 'zustand';
import { Move, RoleType } from '@yard/shared-utils';

export interface RunnerState {
    currentPosition: number;
    currentType: 'bus' | 'taxi' | 'underground' | 'river' | 'secret' | 'double';
    secretTickets: number;
    doubleTickets: number;
    move: Move | null;
    setMove: (move: Move | null) => void;
    updateSecretTickets: (secretTickets: number) => void;
    updateDoubleTickets: (doubleTickets: number) => void;
    setCurrentPosition: (currentPosition: number) => void;
    setCurrentType: (currentType: 'bus' | 'taxi' | 'underground' | 'river' | 'secret' | 'double') => void;
    currentRole?: RoleType;
    setCurrentRole: (role: RoleType) => void;
}

export const useRunnerStore = create<RunnerState>((set) => ({
    currentPosition: 0,
    currentType: 'taxi',
    secretTickets: 5,
    doubleTickets: 2,
    move: null,
    setMove: (move) => set({ move }),
    updateSecretTickets: (secretTickets: number) => set({ secretTickets }),
    updateDoubleTickets: (doubleTickets: number) => set({ doubleTickets }),
    setCurrentPosition: (currentPosition: number) => set({ currentPosition }),
    setCurrentType: (currentType: 'bus' | 'taxi' | 'underground' | 'river' | 'secret' | 'double') => {
        console.log('setCurrentType', currentType);
        set({ currentType });
    },
    currentRole: undefined,
    setCurrentRole: (role) => set({currentRole: role}),
}));
