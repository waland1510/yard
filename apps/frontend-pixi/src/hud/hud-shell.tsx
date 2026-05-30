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

export function HudShell() {
  return (
    <>
      <PlayersDrawer />
      <MovesDrawer />
      <SpecialMoves />
      <TurnBanner />
      <VictoryOverlay />
      <ReplayControls />
      <SystemBar />
      <DebugOverlay />
      <InviteButton />
      <ImpersonationBanner />
    </>
  );
}
