// Pure data + helpers: maps theme name to palette, character images, transport labels,
// and capture/reveal SFX overrides. Single import surface for any theme-aware module.

import type { RoleType } from '@yard/shared-utils';

export type ThemeName = 'classic' | 'harry-potter';

export interface ThemeCharacter {
  name: string;
  image: string;
}

export interface ThemePalette {
  /** Primary UI accent (buttons, focus rings). */
  accent: string;
  /** Reveal spotlight color (rounds 3, 8, 13, 18, 24). */
  reveal: string;
  /** Victory-overlay confetti colors. */
  confetti: string[];
  /** River color in the paper map. */
  river: string;
}

export interface ThemeSfx {
  capture: string;
  reveal: string;
  ticketSpent: string;
  lowTicketWarn: string;
}

export interface ThemeTransportLabels {
  taxi: string;
  bus: string;
  underground: string;
  secret: string;
  double: string;
  river: string;
}

export interface Theme {
  id: ThemeName;
  name: string;
  characters: {
    culprit: ThemeCharacter;
    detectives: [ThemeCharacter, ThemeCharacter, ThemeCharacter, ThemeCharacter, ThemeCharacter];
  };
  transportation: ThemeTransportLabels;
  palette: ThemePalette;
  sfx: ThemeSfx;
}

export const THEMES: Record<ThemeName, Theme> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    characters: {
      culprit: { name: 'Mr. X', image: '/images/culprit.png' },
      detectives: [
        { name: 'Detective 1', image: '/images/detective1.png' },
        { name: 'Detective 2', image: '/images/detective2.png' },
        { name: 'Detective 3', image: '/images/detective3.png' },
        { name: 'Detective 4', image: '/images/detective4.png' },
        { name: 'Detective 5', image: '/images/detective5.png' },
      ],
    },
    transportation: {
      taxi: 'Taxi',
      bus: 'Bus',
      underground: 'Underground',
      secret: 'Secret',
      double: 'Double',
      river: 'River',
    },
    palette: {
      accent: '#ff6b35',
      reveal: '#ff6b35',
      confetti: ['#ff6b35', '#f7c948', '#e25555', '#5a8dde', '#10b981'],
      river: '#6cb8d6',
    },
    sfx: {
      capture: '/audio/capture-classic.wav',
      reveal: '/audio/reveal-classic.wav',
      ticketSpent: '/audio/ticket-classic.wav',
      lowTicketWarn: '/audio/low-warn-classic.wav',
    },
  },
  'harry-potter': {
    id: 'harry-potter',
    name: 'Harry Potter',
    characters: {
      culprit: { name: 'Bellatrix', image: '/images/harry-potter/bellatrix.png' },
      detectives: [
        { name: 'Harry', image: '/images/harry.png' },
        { name: 'Hermione', image: '/images/harry-potter/hermione.png' },
        { name: 'Ron', image: '/images/harry-potter/ron.png' },
        { name: 'Mad-Eye', image: '/images/harry-potter/mad-eye.png' },
        { name: 'Tonks', image: '/images/harry-potter/tonks.png' },
      ],
    },
    transportation: {
      taxi: 'Apparition',
      bus: 'Knight Bus',
      underground: 'Floo Network',
      secret: 'Invisibility Cloak',
      double: 'Time-Turner',
      river: 'Portkey',
    },
    palette: {
      accent: '#ffd700',
      reveal: '#ffd700',
      confetti: ['#7c5cf3', '#ffd700', '#b81f25', '#3a8a52', '#dcd5b8'],
      river: '#ffb733',
    },
    sfx: {
      capture: '/audio/capture-hp.wav',
      reveal: '/audio/reveal-hp.wav',
      ticketSpent: '/audio/ticket-hp.wav',
      lowTicketWarn: '/audio/low-warn-hp.wav',
    },
  },
};

export const DEFAULT_THEME: ThemeName = 'classic';

export function getTheme(id: ThemeName | string | undefined): Theme {
  if (id && id in THEMES) return THEMES[id as ThemeName];
  return THEMES[DEFAULT_THEME];
}

export function characterFor(theme: Theme, role: RoleType): ThemeCharacter {
  if (role === 'culprit') return theme.characters.culprit;
  const index = parseInt(role.replace('detective', ''), 10) - 1;
  return theme.characters.detectives[index] ?? theme.characters.detectives[0];
}

export function transportLabel(theme: Theme, kind: keyof ThemeTransportLabels): string {
  return theme.transportation[kind];
}
