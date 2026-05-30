import type { RoleType } from '@yard/shared-utils';
import type { ThemeName } from '../core/theme-registry';

const VALID_ROLES: ReadonlySet<RoleType> = new Set<RoleType>([
  'culprit',
  'detective1',
  'detective2',
  'detective3',
  'detective4',
  'detective5',
]);

const VALID_THEMES: ReadonlySet<ThemeName> = new Set<ThemeName>(['classic', 'harry-potter']);

export interface UrlSession {
  /** Channel slug from the URL path `/game/:channel`. */
  channel: string;
  /** Player's role from `?role=`. */
  role: RoleType;
  /** Player's name from `?name=`. */
  name: string;
  /** Theme from `?theme=` (defaults to classic). */
  theme: ThemeName;
  /** True when the channel begins with `mock-` — caller can skip the WS connect. */
  isMock: boolean;
  /** False when the URL didn't carry an explicit `role=` and we substituted a default.
   *  The caller should show a role-picker before joining the game. */
  roleExplicit: boolean;
}

/**
 * Returns null only when there's no game channel at all. If the channel is present but
 * role/name/theme query params are missing, defaults are filled in (role=detective1,
 * name='', theme=classic). This lets bare URLs like /game/y6o8gi still enter the game —
 * useful when the user opens the URL in a new tab, hits refresh after losing the query
 * string, or shares the link.
 */
export function parseUrlSession(pathname: string, search: string): UrlSession | null {
  const match = pathname.match(/\/game\/([^/?#]+)/);
  if (!match) return null;
  const channel = decodeURIComponent(match[1]);
  if (!channel || channel === 'demo') return null;

  const params = new URLSearchParams(search);
  const roleParam = params.get('role');
  const name = params.get('name') ?? '';
  const themeParam = params.get('theme');

  const roleExplicit = !!roleParam && VALID_ROLES.has(roleParam as RoleType);
  const role: RoleType = roleExplicit ? (roleParam as RoleType) : 'detective1';
  const theme: ThemeName = themeParam && VALID_THEMES.has(themeParam as ThemeName)
    ? (themeParam as ThemeName)
    : 'classic';

  return {
    channel,
    role,
    name,
    theme,
    isMock: channel.startsWith('mock-'),
    roleExplicit,
  };
}
