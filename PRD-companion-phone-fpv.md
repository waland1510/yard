# PRD — Companion-Phone FPV + Strategic Desktop Map

> **Status:** Draft · **Date:** 2026-06-13 · **App:** `apps/frontend-pixi` (+ `apps/backend`, `shared-utils`)
>
> **Relationship to `PRD.md`:** This builds on the base FPV rebuild (`PRD.md`) and **supersedes three of its decisions** for this feature's scope: (1) "backend left fully unchanged" — the backend is now in scope (the constraint was a one-time requirement, since lifted); (2) "mobile / touch input out of scope" — touch FPV on phones is the core of this feature; (3) "no unit tests" — the sync & authority modules here are tested. Everything else in `PRD.md` stands.

## Problem Statement

Today the Scotland Yard rebuild runs as a single desktop experience: the first-person "video game" view (Three.js FPV) is the *default* surface, and the strategic 2D map is a modal you pop open with TAB. As a player, I have two unmet needs:

1. **I want to play the immersive FPV view on my phone** — moving through London streets feels like a video game and the phone is the natural device for that, but the FPV uses pointer-lock + mouse, which doesn't exist on touch devices, so the FPV is unplayable on a phone today.
2. **On the desktop I want the strategic map to be the main view, and I want it to actually help me understand the whole game** — who is where, where Mr. X probably is, what just happened, what my options cost. The current map is a bolt-on modal that renders nodes and edges but drops most of the situational-awareness polish the *legacy* frontend already had (movement trails, reveal spotlights, valid-move pulses, turn-camera framing, reveal countdown, low-ticket warnings), and it never renders the deduction data it already computes (the heatmap weights and move-preview simulation exist in code but are not shown).

In short: one player, one game, but the right surface depends on the device — and neither surface is currently good enough.

## Solution

Make a single player drive **two paired surfaces at once**: their **phone runs the immersive FPV** (with touch controls and upgraded graphics) while their **desktop shows the strategic map as the default, full-screen view** (with legacy-parity polish plus live deduction overlays). The two devices are the *same seat/role* in the same game, linked by a pairing code (QR scan), and the backend coordinates them.

Concretely:

- **Pairing:** the desktop (primary) shows a QR / pairing code; the phone scans it and attaches to the *same role* as the FPV-controller surface. The server links the two sockets as one logical player with two surfaces.
- **Surface roles:** desktop = strategic map (default on desktop), phone = FPV controller (default on phone). View mode is auto-resolved from device class with a manual override.
- **Move authority:** the server designates exactly one committer per role, so the two paired devices never race on a move. The FPV controller picks a move; it is relayed and committed under the single authority; the map mirrors the result.
- **State sync:** authoritative game state still flows over the existing WebSocket to both devices; transient *view/intent* state (the half-entered move, who you're impersonating, camera focus) is relayed between the paired devices through new, additive WebSocket message types — without polluting authoritative game state.
- **FPV graphics:** a full fidelity pass — a post-processing stack (bloom, SSAO, color grading, depth-of-field) plus asset/geometry upgrades (better vehicles, PBR detail maps, animated water, weather, foliage) — with quality tiers so it stays smooth on a phone.
- **Strategic map:** port every legacy situational-awareness feature into the new map and add the deduction overlays the data already supports (heatmap, hover move-preview, ticket-loss delta, on-map replay).

**Architecture decision:** the earlier "backend untouched" constraint has been lifted. The optimal design coordinates companion devices **server-side** over the existing WebSocket channel — not peer-to-peer WebRTC. This removes signaling/NAT/TURN complexity, makes the server the natural rendezvous for true remote play, and lets move authority be arbitrated authoritatively in one place.

## User Stories

### Pairing & connecting two devices

1. As a player on desktop, I want to see a QR code / short pairing code for my game, so that I can attach my phone as the FPV controller without retyping a long URL.
2. As a player, I want to scan the desktop's QR code with my phone, so that my phone joins the *same game and the same seat*, not a separate player slot.
3. As a player, I want the phone and desktop to be recognized as one logical player with two surfaces, so that I don't appear twice in the roster or occupy two seats.
4. As a player, I want the pairing code to expire / be single-use, so that a stale screenshot of my code can't let a stranger hijack my seat.
5. As a player, I want to start on my phone alone and later pair a desktop (or vice versa), so that either device can be the one that initiates pairing.
6. As a player, I want clear feedback when pairing succeeds ("Phone connected — FPV active here, map on desktop"), so that I know the handoff worked.
7. As a player, I want clear feedback when my paired device drops (phone sleeps, Wi-Fi dies), so that I understand why the FPV froze and how to reconnect.
8. As a player, I want to re-pair quickly after a disconnect without losing my place in the game, so that a dropped phone doesn't cost me the match.
9. As a player, I want to unpair a device, so that I can hand the phone to someone else or stop the companion session cleanly.
10. As a player, I want the system to refuse a second controller for the same seat (or explicitly take over), so that two phones can't both drive my FPV at once.

### Choosing the right surface per device

11. As a desktop player, I want the strategic map to be my default, full-screen view (not a modal), so that I plan with the big picture in front of me.
12. As a phone player, I want the FPV to be my default, full-screen view, so that the phone is the immersive controller.
13. As a player, I want the app to auto-detect my device class (touch vs pointer) and pick the right default surface, so that it "just works" without configuration.
14. As a player, I want to manually override the surface on any device (force map on phone, force FPV on desktop), so that I'm not locked into the default if I prefer otherwise.
15. As a solo desktop player with no phone paired, I want to still access the FPV (and the map) on one device, so that companion play is an enhancement, not a requirement.
16. As a player, I want the desktop map and the phone FPV to stay focused on the same context (current node, selected destination, impersonated detective), so that the two screens feel like one game.

### Playing the FPV from the phone (touch)

17. As a phone player, I want to look around the FPV by dragging on the screen, so that I can aim the camera without a mouse or pointer-lock.
18. As a phone player, I want to tap a vehicle/destination to board it, so that I can move without a click-to-pick raycaster meant for a mouse cursor.
19. As a phone player, I want camera drag sensitivity tuned for touch and my screen size, so that aiming feels natural rather than hyper-fast or sluggish.
20. As a phone player, I want the on-screen controls and labels sized for a phone, so that I can read destinations and act without mis-tapping.
21. As a phone player, I want the FPV to remain playable in the mobile browser (no pointer-lock dependency), so that I don't hit a silent failure on iOS/Android.
22. As a phone player, I want my pending move (the destination I'm lining up) to show on the desktop map, so that I can sanity-check the route on the big screen before committing.
23. As a phone player, I want my committed move to immediately update the desktop map, so that the two surfaces never disagree about where I am.

### Move authority & turn flow across two devices

24. As a player, I want exactly one of my two devices to commit a move at a time, so that I never double-submit or fight myself.
25. As a player, I want the FPV controller (phone) to be the mover by default while the map (desktop) observes, so that the immersive surface is where I act.
26. As a player, I want to commit a move from the desktop map too if I choose (e.g., phone is dead), so that I'm never blocked from playing.
27. As a player, I want move validation (tickets, connectivity, collisions, secret/double rules) applied consistently regardless of which surface initiates, so that the rules feel identical on both screens.
28. As Mr. X, I want secret/double-move toggles to work the same on whichever surface I act from, so that my special moves aren't surface-dependent.
29. As a player, I want a clear "it's your turn" cue on *both* surfaces, so that I notice my turn whether I'm looking at the phone or the desktop.

### Understanding the whole game on the strategic map (legacy parity)

30. As a detective, I want a fading movement trail behind each player, so that I can read recent movement direction at a glance.
31. As a player, I want the map camera to auto-zoom to the active detective on their turn and reset to the full board on Mr. X's turn, so that the map frames whatever matters right now.
32. As a player, I want an animated reveal spotlight at Mr. X's position on reveal rounds, so that I immediately notice and locate a reveal.
33. As a player, I want a visible reveal countdown ("Reveal in 3") and a reveal indicator ("✓ Round 8"), so that I can plan around when Mr. X will surface.
34. As a player, I want valid destinations to pulse and invalid clicks to flash, so that I get immediate, legible feedback while choosing a move.
35. As a player, I want per-transport ring indicators on each station (bus/underground/river), so that I can see a station's connectivity without tracing edges.
36. As a player, I want my low ticket counts (1–2 left) to pulse and color-code, so that I'm warned before I strand myself.
37. As a player, I want a brief move-effect flourish at the origin/destination of a move, so that moves feel responsive and I can follow what happened.
38. As a player, I want a screen-shake / emphasis on key events (e.g., a capture), so that decisive moments register.
39. As a player, I want each player's position widget to censor Mr. X correctly (`??` until reveal), so that hidden information stays hidden on the map just like the rules require.
40. As a player, I want the move-history timeline and per-player ticket panels visible alongside the map, so that I have the full public record without leaving the strategic view.

### Understanding the whole game — deduction overlays (legacy parity "and more")

41. As a detective, I want a heatmap overlay on the map showing where Mr. X probably is (per-node intensity from the deduction weights), so that I can reason spatially instead of reading a debug list.
42. As a detective, I want to toggle the heatmap on/off, so that I can switch between a clean board and the probability view.
43. As a detective, I want to hover a candidate destination and preview how it would change Mr. X's possible-position set, so that I can pick the move that narrows the search the most.
44. As a player, I want to see "tickets left after this move" when hovering a destination, so that I understand the cost before committing.
45. As a player, I want to replay past rounds animated on the strategic map (positions + trail), so that I can review how the chase unfolded, not just scrub a list.
46. As a detective, I want a sense of Mr. X's likely next moves / reachable area, so that I can coordinate to cut off escape routes.
47. As a detective, I want a capture-zone / proximity indication around detectives, so that I can tell when we have Mr. X surrounded.
48. As a player, I want the deduction overlays to respect hidden information (never reveal Mr. X's true position outside reveal rounds), so that the overlays are a legal planning aid, not a cheat.

### FPV graphics (full fidelity pass)

49. As a phone player, I want richer lighting and post-processing (bloom on lit signage, ambient occlusion, color grading), so that the street scene looks like a polished video game rather than flat geometry.
50. As a player, I want better vehicle models and surface detail (PBR maps on buildings/roads), so that boarding a taxi/bus/tube/ferry feels tactile and real.
51. As a player, I want animated water and atmospheric touches (weather, foliage motion), so that the world feels alive during rides and idling.
52. As a phone player, I want the graphics to automatically tier down to keep the framerate smooth on my device, so that fidelity never costs me playability.
53. As a desktop player, I want the highest fidelity tier (e.g., depth-of-field, full post-stack), so that the immersive view looks its best on capable hardware.
54. As a player, I want a graphics quality setting (auto/low/high), so that I can trade fidelity for performance if I want.

### Resilience & cross-device consistency

55. As a player, I want authoritative game state to keep flowing to both devices over the existing connection, so that a relay hiccup never corrupts the actual game.
56. As a player, I want transient view state (pending move, impersonation, camera focus) to sync between my devices but be clearly separate from game state, so that a sync glitch can't desync the real game.
57. As a player, I want the system to detect a sleeping/dropped companion via heartbeat, so that the UI reflects reality instead of showing a phantom paired device.
58. As a player, I want reconnection to restore my surface role and pairing, so that picking my phone back up resumes the FPV where I left off.
59. As a detective, I want impersonation (viewing another detective's perspective) to be reflected across my paired surfaces, so that the phone FPV and desktop map agree on whose view I'm in.

## Implementation Decisions

### Architecture & topology

- **Server-coordinated companion model (not P2P).** Both devices connect to the existing game channel over the current WebSocket. The backend gains device-scoped identity and links two sockets that share one role as a single logical player with two *surfaces*. WebRTC/P2P is explicitly rejected (signaling/NAT/TURN cost, no central authority).
- **One player, two surfaces, same role.** The desktop and phone occupy the *same seat*. Presence and roster must show one player, not two.
- **Backend is in scope.** The prior "backend untouched / client-side-only" posture has been removed from the docs. Companion coordination, device-scoped presence, the relay, and move-authority arbitration live on the server; this is the optimal place for them.
- **Authoritative game state path is unchanged.** `GameState` / `Player` / `Move` shapes and the existing broadcast flow stay as-is. Companion features are *additive*.

### New / modified deep modules

**Coordination (net + game-logic) — the modules under test:**

- **`CompanionSession`** — owns the pairing lifecycle. Responsibilities: a primary issues a single-use, expiring pairing code; a companion redeems it; the server links the two sockets to one role and assigns each a surface; emits `peerAttached` / `peerLost`. Interface shape: `issuePairingCode(channel, role) → { code, expiresAt }`; `redeem(channel, code, deviceProfile) → { clientId, surface, peer }`; `surface() → 'map-primary' | 'fpv-companion'`; `peer() → { clientId, surface } | null`. Single redeem only; expired/duplicate redeem rejected.
- **`MoveAuthority`** — decides which paired device may commit a move for a shared role, server-enforced. Interface shape: pure decision `canCommit(clientId, currentTurn, pairingState, surfaceRole) → boolean`; `delegateTo(clientId)`. Invariant: for a given role and turn, exactly one paired client returns `true`. Default committer = the FPV controller; falls back to the surviving device if its peer drops.
- **`DeviceSurfaceResolver`** (folded into `RunnerStore` as `deviceType` / `viewMode` / `surfaceRole`) — pure resolver `resolveSurface(deviceProfile, pairingState) → 'fpv' | 'map'`, where `deviceProfile` is derived from pointer/touch + viewport. Manual override wins over auto.
- **`CompanionRelay`** — relays transient view/intent state between paired devices through new, additive WebSocket message types (e.g. relay pending-move, relay impersonation/`viewingAs`, relay camera focus, request move delegation). Interface shape: `send(kind, payload)`, `on(kind, handler)`. Hard rule: relayed payloads are view/intent only and must **not** be merged into `GameStateStore`.

**Render — FPV:**

- **`FpvPostProcessing`** — an EffectComposer pass stack (bloom on emissives, SSAO, color grade/vignette, optional DoF on desktop) layered over the existing renderer, with `setQuality('low' | 'high')` tiers and a mobile-safe default. Must interoperate with the existing ACES tone mapping and the streamed Google 3D Tiles.
- **`FpvFidelityAssets`** — the geometry/material upgrade workstream: higher-fidelity vehicle models, normal/roughness detail maps on buildings/roads, an animated water shader, weather (rain/cloud shadows), and foliage motion. Tiered with the post-processing quality setting.
- **`TouchControls`** — touch-drag yaw/pitch + tap-to-pick for the phone FPV, mirroring the output contract of the existing pointer-lock controls so the rest of the FPV pipeline is unchanged. Replaces pointer-lock (unavailable on mobile).

**Render — strategic map:**

- **`StrategicMapShell`** — promotes the map from a TAB modal to the desktop *default* full-screen surface, with the move-history timeline and per-player ticket panels arranged for situational awareness.
- **`MapEffects`** — ports the legacy flourishes: movement trail, reveal spotlight, valid-move pulse + invalid flash, per-transport station rings, move-effects at origin/destination, screen shake, low-ticket pulse. Ticker-driven; each effect returns a cancel handle.
- **`MapCameraController`** — turn-based auto zoom-to-detective and reset-on-Mr.X-turn, plus reveal-countdown framing. Pure target computation `frameFor(turn, players) → { center, zoom }` behind the camera animation.
- **`HeatmapLayer`** — renders the deduction `weights` as a per-node gradient/intensity overlay; reads the existing `heatmapEnabled` flag. Pure mapping `weights → per-node color/opacity`. Must consume the deduction engine read-only.
- **`DeductionPreview`** — wires the existing (currently unused) move-preview computation so hovering a destination shows the would-be change in Mr. X's possible-set and the ticket-loss delta. Pure given `(moves, players, hypotheticalMove)`. Consumes the deduction engine read-only.

**Modified:**

- **Game orchestration** — the HUD/surface gate becomes a function of the resolved surface (`resolveSurface`) and pairing state, rather than the hardcoded "FPV unless map modal is open." Desktop → map default; phone → FPV default.
- **`RunnerStore`** — add `deviceType`, `viewMode`, `surfaceRole`, and pairing fields; keep relayed companion state separate from authoritative state.
- **`shared-utils` protocol** — add new `MessageType` values and device/surface metadata to presence. **Additive**, but still a WebSocket-protocol change → coordinate frontend + backend; do not alter `GameState` / `Player` / `Move` shapes.
- **Backend WebSocket handler** — device-scoped presence (`clientId`, `deviceType`, `surface`), pairing routing, relay routing, server-side `MoveAuthority` arbitration, and a heartbeat/liveness timeout to detect dropped companions.

### Contracts & constraints

- **Deduction engine is a hard gate.** `HeatmapLayer` and `DeductionPreview` only *consume* its output; no edits to `deduction-engine.ts` (and if any are ever needed, unit tests are a pre-merge gate).
- **Reveal rounds:** use the active frontend constant `[3, 8, 13, 18, 24]` — do **not** copy the legacy list `[3, 5, 8, 13, 18, 21, 24]`, or reveal visuals will mis-fire.
- **Hidden information:** all map/deduction overlays must respect Mr. X censoring (no true position outside reveal rounds).
- **Layer contracts hold:** render modules read render-state/selector output, never import stores into Three/Pixi objects; relayed companion state never enters `GameStateStore`.

## Testing Decisions

**Scope (per decision):** unit tests are written **only for the Sync & Authority modules**. Render/graphics modules (post-processing, fidelity assets, map effects, touch controls, heatmap/preview visuals) and the live WebSocket/relay transport are validated by integration/manual play, not unit tests, because their value is in visual/timing behavior and real network conditions that unit tests model poorly.

**What makes a good test here:** assert *external behavior and contract*, not implementation details. For these modules that means feeding inputs (pairing codes, device profiles, turn/role/pairing state) and asserting the decision/output, with no coupling to internal data structures or render side effects.

**Modules under test and the behaviors to cover:**

- **`CompanionSession`** — a freshly issued code redeems exactly once and links the companion to the correct role/surface; a second redeem of the same code is rejected; an expired code is rejected; `peerAttached` / `peerLost` fire on attach/detach; pairing survives a reconnect (re-redeem restores the same surface role).
- **`MoveAuthority`** — given a role with two paired clients, exactly one returns `canCommit === true` for the current turn; the FPV controller is the default committer; on peer loss, authority transfers to the surviving device; a companion cannot commit while the primary holds authority; `delegateTo` flips the committer deterministically.
- **`DeviceSurfaceResolver` (`resolveSurface`)** — touch/coarse-pointer profile resolves to FPV, fine-pointer/desktop resolves to map, a manual override beats the auto decision, and an unpaired solo device still resolves to a usable surface.

**Prior art in the codebase:** the pure, deterministic test style already used for `shared-utils/src/lib/deduction-engine.ts` and the client-side `move-validator` is the model — same shape of "given inputs → assert decision," same `@nx/jest` setup. (Note: the base `PRD.md` deferred all tests; this feature reverses that for these three modules only.)

## Out of Scope

- **WebRTC / peer-to-peer transport** — explicitly rejected in favor of server coordination.
- **Moving *all* game-rule validation to the server** — this feature adds server-side *coordination* (presence, pairing, relay, move authority) only. Rule validation stays where it is today; a broader server-authoritative-rules effort is a separate initiative.
- **Account-grade authentication / cross-network security hardening** — pairing uses a single-use expiring code suitable for the intended use; full auth, accounts, and abuse-hardening are not in scope.
- **Legacy frontend (`apps/frontend`) changes** — it is the *reference* for map parity, not a delivery target.
- **New themes, characters, or game modes.**
- **Spectator mode and replay export/screenshot** — possible future, not part of this PRD.
- **Unit tests for the render/graphics, map-effects, touch, and relay-transport modules** — deferred by decision; covered by integration/manual play instead.
- **Three-or-more surfaces per seat** — the model is exactly two surfaces (one map, one FPV) per role.

## Further Notes

- **Map rendering ceiling:** the new map deliberately uses the classic Google Maps Marker API (a `mapId` + inline-style conflict blocks AdvancedMarkerElement). A dense heatmap + trails + spotlights across 200+ nodes may exceed per-marker performance; plan for a data-driven overlay/canvas layer rather than one marker per visual element.
- **Mobile FPV performance budget:** the full fidelity pass (post-processing + asset upgrades) is stacked on top of streamed Google 3D Tiles, which is GPU-heavy on phones. Quality tiering is mandatory; the heaviest passes default off/low on mobile and the framerate target gates fidelity.
- **Pointer-lock is unavailable on iOS/Android** — `TouchControls` is required, not optional, for the phone FPV.
- **Protocol coordination:** new `MessageType` values and presence metadata are additive but still a WebSocket-protocol change; land the `shared-utils` types first and coordinate the frontend and backend together.
- **Truly remote play** (phone not on the same network as the desktop) works because the server is the rendezvous, but the desktop/host must remain online for the companion session; this is acceptable given the server-coordinated model.
- **Existing assets to reuse:** the deduction `weights` and the (currently unused) move-preview computation already exist — the map work is largely *wiring and rendering* existing data, plus porting legacy visual polish, rather than inventing new game logic.
- **Supersedes in `PRD.md`:** "Backend changes of any kind: out of scope" (now in scope), "Mobile / touch input: out of scope" (now core), and the blanket "no unit tests" (reversed for the three sync/authority modules above).
