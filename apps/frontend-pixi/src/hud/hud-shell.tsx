// Top-level HUD container. Mounts every React-side game UI element so game.tsx doesn't
// have to track them individually. Drawer chrome, banners, overlays — all here.

import { PlayersDrawer } from './players-drawer';
import { MovesDrawer } from './moves-drawer';
import { TurnBanner } from './turn-banner';
import { VictoryOverlay } from './victory-overlay';
import { SpecialMoves } from './special-moves';
import { ReplayControls } from './replay-controls';
import { SystemBar } from './system-bar';
import { DebugOverlay } from './debug-overlay';
import { InviteButton } from './invite-button';
import { ImpersonationBanner } from './impersonation-banner';
import { PairControl } from './pair-control';
import { GraphicsToggle } from './graphics-toggle';
import { useRunnerStore, selectActiveSurface } from '../stores/runner-store';

export function HudShell() {
  // The players list + move log belong on the strategic map (where you study the whole
  // picture), not over the immersive FPV. They render only when the map surface is active.
  const onMap = useRunnerStore(selectActiveSurface) === 'map';
  return (
    <>
      {onMap && <PlayersDrawer />}
      {onMap && <MovesDrawer />}
      <SpecialMoves />
      <TurnBanner />
      <VictoryOverlay />
      <ReplayControls />
      <SystemBar />
      <DebugOverlay />
      <InviteButton />
      <ImpersonationBanner />
      <PairControl />
      <GraphicsToggle />
    </>
  );
}
