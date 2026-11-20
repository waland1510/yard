import { useSyncExternalStore } from 'react';
import { detectDeviceProfile, isTouchPrimary } from '../core/device-surface';

const NARROW_QUERY = '(max-width: 600px)';

function subscribeNarrow(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True at phone widths, where fixed HUD clusters have to stack instead of sharing a row. */
export function useNarrowViewport(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false
  );
}

export function useTouchPrimary(): boolean {
  return isTouchPrimary(detectDeviceProfile());
}
