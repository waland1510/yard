// Top-level HUD container. Mounts every React-side game UI element so game.tsx doesn't
// have to track them individually. Drawer chrome, banners, overlays — all here.

import { Dock } from './dock';
import { TopPills } from './top-pills';
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
  // The squad roster + Mr. X trail belong on the strategic map (where you study the whole
  // picture), not over the immersive FPV. The dock renders only when the map surface is
  // active; while unmounted it resets `--hud-shift` so overlays centre on the window.
  const onMap = useRunnerStore(selectActiveSurface) === 'map';
  return (
    <>
      {onMap && <Dock />}
      <TopPills />
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
