import { RoleType } from '@yard/shared-utils';
import { themes } from '../app/themes';

export const resolveCharacter = (
  role: RoleType | string | undefined,
  themeName: string | undefined
): { name: string; image: string } => {
  const theme = themes[themeName ?? 'classic'] ?? themes.classic;
  if (!role) return theme.characters.culprit;
  if (role === 'culprit') return theme.characters.culprit;
  const idx = parseInt(String(role).replace('detective', ''), 10) - 1;
  return theme.characters.detectives[idx] ?? theme.characters.detectives[0];
};

export const characterImageFor = (
  role: RoleType | string | undefined,
  themeName: string | undefined,
  fallback?: string
): string => fallback || resolveCharacter(role, themeName).image;
