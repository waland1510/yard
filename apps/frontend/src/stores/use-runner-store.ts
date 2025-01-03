import {create} from 'zustand';
import { Role } from './use-game-store';

interface RunnerState {
    currentPosition: number;
    currentType: string;
    secretTickets: number;
    doubleTickets: number;
    move: (target: number) => void;
    updateSecretTickets: (secretTickets: number) => void;
    updateDoubleTickets: (doubleTickets: number) => void;
    setCurrentPosition: (currentPosition: number) => void;
    setCurrentType: (currentType: string) => void;
    currentRole: Role;
    setCurrentRole: (role: Role) => void;
}

export const useRunnerStore = create<RunnerState>((set) => ({
    currentPosition: 117,
    currentType: '',
    secretTickets: 5,
    doubleTickets: 2,
    move: (target: number) => set({ currentPosition: target }),
    updateSecretTickets: (secretTickets: number) => set({ secretTickets }),
    updateDoubleTickets: (doubleTickets: number) => set({ doubleTickets }),
    setCurrentPosition: (currentPosition: number) => set({ currentPosition }),
    setCurrentType: (currentType: string) => {
        console.log('setCurrentType', currentType);
        set({ currentType });
    },
    currentRole: 'detective1',
    setCurrentRole: (role) => set({currentRole: role}),
}));
