# Issues — Companion-Phone FPV + Strategic Desktop Map

Vertical tracer-bullet slices derived from [PRD-companion-phone-fpv.md](PRD-companion-phone-fpv.md). Each slice cuts end-to-end (shared-utils → backend → net → store → render) and is demoable on its own. Written in dependency order (blockers first). All slices are AFK; the protocol/contract additions in #1 are built directly (land shared-utils types first and keep frontend + backend in the same change).

Three largely-parallel tracks: **A** = companion device pairing & coordination, **B** = FPV graphics fidelity, **C** = strategic map understanding.

---

## 1. Device identity + pairing handshake

**Type:** AFK
**Blocked by:** None

### What to build

The foundation for two devices acting as one player. Add device-scoped identity to the WebSocket layer and a pairing handshake so a phone can attach to the *same role/seat* a desktop already holds.

End-to-end: a primary device (desktop) requests a single-use, expiring pairing code and renders it as a QR + short code. The phone opens that QR (game URL + code), redeems it, and the server links the two sockets to one role, tagging each with a `clientId`, `deviceType`, and `surface` (`map-primary` / `fpv-companion`). Presence is extended to carry this metadata so the roster shows **one** logical player, not two seats. Both devices display a "paired" indicator naming the peer's surface.

This introduces new additive `MessageType` values and presence-metadata fields in `shared-utils`. Land the shared types first, then the backend handler and the client together in the same change — do not alter `GameState` / `Player` / `Move` shapes.

### Acceptance criteria

- [ ] New `shared-utils` `MessageType` values for pairing (issue code, redeem, paired/peer-lost) are defined; `GameState`/`Player`/`Move` shapes are unchanged.
- [ ] Server assigns a stable `clientId` per socket and includes `{ clientId, deviceType, surface }` in presence broadcasts.
- [ ] A primary can request a pairing code; the code is single-use and expires; redeeming it twice or after expiry is rejected with clear feedback.
- [ ] Desktop renders the pairing code as a scannable QR plus a short fallback code.
- [ ] Scanning/redeeming on the phone attaches it to the *same role* as the `fpv-companion` surface; the desktop becomes `map-primary`.
- [ ] The roster/presence shows one logical player for the paired pair (no duplicate seat), and each device shows a "paired — peer is on FPV/map" indicator.
- [ ] `CompanionSession` exposes the lifecycle interface (`issuePairingCode`, `redeem`, `surface()`, `peer()`) and emits `peerAttached` / `peerLost`.
- [ ] Unit tests for `CompanionSession`: code redeems exactly once, expired/duplicate redeem rejected, `peerAttached`/`peerLost` fire on attach/detach.

---

## 2. Surface defaults + manual override

**Type:** AFK
**Blocked by:** None

### What to build

Make the *right* surface the default per device and let the player override it. Desktop boots into the strategic map as a full-screen default surface (promoted from today's TAB modal); phone boots into the FPV. A pure `resolveSurface(deviceProfile, pairingState)` decides the default from pointer/touch capability + viewport, and a manual override toggle lets any device flip surfaces. Works solo (unpaired) so companion play is an enhancement, not a requirement — a solo desktop can still flip to FPV and back.

Adds `deviceType`, `viewMode`, and `surfaceRole` fields to `RunnerStore`; the game orchestration's HUD/surface gate becomes a function of the resolved surface instead of the hardcoded "FPV unless map modal is open."

### Acceptance criteria

- [ ] On a desktop/pointer device, the app boots into the strategic map as a full-screen surface (not a modal).
- [ ] On a touch device, the app boots into the FPV surface.
- [ ] A manual override toggle switches the active surface on any device and persists for the session.
- [ ] A solo (unpaired) device can access both surfaces via the override; no pairing is required to use the app.
- [ ] `resolveSurface` is a pure function consuming a device profile + optional pairing state; manual override beats the auto decision; unpaired devices still resolve to a usable surface.
- [ ] Unit tests for `resolveSurface`: touch→FPV, pointer→map, override wins, unpaired solo resolves usably.

---

## 3. FPV post-processing stack + quality tiers

**Type:** AFK
**Blocked by:** None

### What to build

A visible jump in FPV fidelity via a post-processing pass stack layered over the existing Three.js renderer. Add an EffectComposer with bloom on emissive signage, SSAO for contact shadows, color grade/vignette, and optional depth-of-field on capable hardware. Expose `setQuality('low' | 'high')` tiers with a mobile-safe default, plus an auto/low/high quality setting in the HUD. Must coexist with the existing ACES Filmic tone mapping and the streamed Google Photorealistic 3D Tiles.

### Acceptance criteria

- [ ] An EffectComposer pass stack (bloom, SSAO, color grade/vignette) renders over the existing scene without breaking ACES tone mapping or 3D-tile streaming.
- [ ] `FpvPostProcessing` exposes `attach(renderer, scene, camera)` returning a `render(dt)` / `setQuality(tier)` / `dispose()` handle; the world tick uses the composer instead of a direct render.
- [ ] Optional DoF runs only on the high tier (desktop default).
- [ ] Quality auto-detects a mobile-safe default and can be overridden via an auto/low/high setting.
- [ ] Each tier renders without error and `dispose()` releases render targets (no GPU-memory leak on surface switch).
- [ ] Framerate on a representative phone stays within target at the low tier.

---

## 4. Strategic map: legacy-parity effects + turn camera

**Type:** AFK
**Blocked by:** None

### What to build

Port the legacy frontend's situational-awareness polish onto the new Google-Maps strategic board so a player can read the whole game at a glance. Bring across: fading per-player movement trail, reveal spotlight at Mr. X's reveal positions, reveal countdown + "✓ Round N" indicator, pulsing valid destinations + invalid-click flash, per-transport station rings (bus/underground/river), low-ticket pulse + color coding, origin/destination move-effects, screen shake on key events (e.g. capture), and correct Mr. X censoring (`??` until reveal). Add turn-based camera automation: auto zoom-to-active-detective on their turn, reset to full board on Mr. X's turn. Keep the move-history timeline and per-player ticket panels visible alongside the map.

Use the active reveal-round constant `[3, 8, 13, 18, 24]` (not the legacy `[3, 5, 8, 13, 18, 21, 24]`). Because the map uses the classic Google Maps Marker API, prefer a data-driven overlay/canvas layer for dense effects rather than one marker per visual element.

### Acceptance criteria

- [ ] Each player leaves a fading, role-colored movement trail that auto-expires.
- [ ] On reveal rounds (`[3, 8, 13, 18, 24]`), an animated spotlight plays at Mr. X's revealed node; a reveal countdown and "✓ Round N" indicator are shown.
- [ ] Valid destinations pulse; an invalid click flashes feedback.
- [ ] Stations show per-transport ring indicators; low ticket counts (1–2) pulse and color-code; a key event (capture) triggers screen shake.
- [ ] Mr. X's position renders as `??` except on reveal rounds or to Mr. X / post-game.
- [ ] The map camera auto-zooms to the active detective on their turn and resets to the full board on Mr. X's turn (`MapCameraController.frameFor` computes the target).
- [ ] Move-history timeline and per-player ticket panels are visible alongside the map without leaving the strategic view.
- [ ] Effects are ticker-driven and cancel cleanly on unmount/surface switch (no leaked animation loops).

---

## 5. Deduction heatmap overlay + toggle — ❌ DROPPED

**Status:** Removed by decision (2026-06-13). A probability heatmap is a deduction crutch
that isn't wanted for human players — the legacy map (the parity target) never had one, and
the request was to match legacy "and more" in *situational-awareness* terms, not to automate
deduction. The deduction engine remains untouched and continues to serve any AI logic.

---

## 6. Companion state relay

**Type:** AFK
**Blocked by:** #1

### What to build

Keep the paired surfaces feeling like one game by relaying *transient view/intent* state between them: the half-entered pending move, the impersonated detective (`viewingAs`), and camera focus. The phone's lining-up move shows on the desktop map before commit; impersonation is reflected on both surfaces. Relay rides new additive message types through the existing channel via `CompanionRelay`. Hard rule: relayed payloads are view/intent only and must **not** be merged into `GameStateStore`.

### Acceptance criteria

- [ ] A pending move being lined up on the phone FPV appears as a preview on the desktop map (and vice versa) before commit.
- [ ] Impersonation (`viewingAs`) selected on one surface is reflected on the paired surface.
- [ ] Camera focus / current-node context stays in sync across the two surfaces.
- [ ] `CompanionRelay` exposes `send(kind, payload)` / `on(kind, handler)`; relay is rejected when the device is unpaired.
- [ ] Relayed state lives outside `GameStateStore`; a relay drop or glitch cannot desync authoritative game state.

---

## 7. Move authority arbitration

**Type:** AFK
**Blocked by:** #1

### What to build

Guarantee that exactly one of a player's two paired devices commits a move at a time, so the surfaces never race or double-submit. The server designates a single committer per role; the FPV controller (phone) is the default mover while the map (desktop) observes, but the desktop can commit too (e.g., phone is dead). Authority transfers to the surviving device on peer loss. Move validation (tickets, connectivity, detective collision, secret/double rules) applies identically regardless of which surface initiates. A clear "your turn" cue shows on both surfaces.

### Acceptance criteria

- [ ] For a given role and turn, exactly one paired client is permitted to commit; the other's commit attempt is rejected/ignored.
- [ ] The FPV controller is the default committer; the desktop can take over and commit.
- [ ] On peer loss, commit authority transfers to the surviving device automatically.
- [ ] Move validation produces identical verdicts whichever surface initiates (incl. Mr. X secret/double).
- [ ] A "your turn" cue appears on both paired surfaces at turn start.
- [ ] `MoveAuthority.canCommit` is a pure decision and `delegateTo` flips the committer deterministically.
- [ ] Unit tests for `MoveAuthority`: exactly one committer per role/turn; FPV controller is default; authority transfers on peer loss; companion cannot commit while primary holds authority; `delegateTo` flips deterministically.

---

## 8. Touch FPV controls

**Type:** AFK
**Blocked by:** #2

### What to build

Make the FPV playable on a phone without pointer-lock (which is unavailable on iOS/Android). Add `TouchControls`: drag to look (yaw/pitch within the existing clamps) and tap a vehicle/destination to board it, replacing the mouse-delta + screen-center raycaster. Sensitivity is tuned for touch and screen size, and on-screen labels/controls are sized for a phone. `TouchControls` mirrors the output contract of the existing pointer-lock controls so the rest of the FPV pipeline is unchanged.

### Acceptance criteria

- [ ] Dragging on the FPV canvas rotates the camera (yaw/pitch) within the existing pitch clamps.
- [ ] Tapping a vehicle/destination boards it (no pointer-lock, no center-crosshair pick required).
- [ ] Drag sensitivity feels natural across phone screen sizes (tuned, not the hardcoded 1080p mouse value).
- [ ] Vehicle destination labels and controls are legible and tappable on a phone without mis-taps.
- [ ] The FPV loads and is playable in mobile Safari/Chrome with no pointer-lock dependency or silent failure.
- [ ] `TouchControls` emits the same camera/pick output contract as the pointer-lock controls; the downstream FPV pipeline is unmodified.

---

## 9. FPV asset & geometry upgrade

**Type:** AFK
**Blocked by:** #3

### What to build

Deepen FPV realism with upgraded assets and geometry, tiered with the post-processing quality setting from #3. Better vehicle models (taxi/bus/underground/ferry), normal/roughness detail maps on buildings and roads, an animated water shader for river arms, weather (rain / cloud shadows), and foliage motion. Heavier passes scale down or off on the low (mobile) tier.

### Acceptance criteria

- [ ] Vehicles render with upgraded models over the current box/cylinder primitives.
- [ ] Buildings and roads carry normal/roughness detail maps replacing flat smooth faces.
- [ ] River water is animated (waves/flow), replacing the flat transparent plane.
- [ ] Weather (rain and/or cloud shadows) and foliage motion are present on the high tier.
- [ ] All asset upgrades respect the quality tier from #3: heavy effects reduce or disable on the low/mobile tier.
- [ ] Geometry and material disposal remains clean on intersection rebuild / surface switch (no leaks).

---

## 10. Hover ticket-loss delta

**Type:** AFK
**Blocked by:** None

### What to build

A small planning nicety on the strategic map: when hovering a candidate destination, show
how many tickets of that transport the player would have left after committing the move
(e.g. "Bus · 2 left after"). The FPV already shows this on vehicle hover; bring the same
hint to the map's destination markers.

> Note: the original "deduction preview" half of this slice (visualizing how a move would
> change Mr. X's possible-position set) was dropped together with the heatmap (#5) — it is
> the same deduction-crutch class of feature and isn't wanted for human players.

### Acceptance criteria

- [ ] Hovering a destination on the map shows "N left after" for the relevant transport.
- [ ] River destinations (free for Mr. X) read as free rather than a ticket count.
- [ ] No deduction/possible-set visualization is added.

---

## 11. On-map replay + capture-zone

**Type:** AFK
**Blocked by:** #4

### What to build

Let players review the chase on the strategic map and read pressure on Mr. X. Animate past rounds (player positions + movement trail, reusing #4's effects) on the map driven by the existing replay controller, with the same scrub/prev/next controls applied to the board. Add a capture-zone / proximity indication around detectives so it's clear when Mr. X is being surrounded.

### Acceptance criteria

- [ ] Replay mode animates past positions and trails on the strategic map (not just a textual move list).
- [ ] Scrub / prev / next navigation drives the on-map animation via the existing replay controller.
- [ ] A "REPLAY" indicator distinguishes replay from live state; stragglers/live updates don't overwrite the replay view.
- [ ] A capture-zone / proximity radius is shown around detectives, making "surrounded" legible.
- [ ] On-map replay reuses the #4 trail/effects rendering rather than duplicating it.

---

## 12. Companion resilience: heartbeat, reconnect, unpair

**Type:** AFK
**Blocked by:** #1, #7

### What to build

Make the paired session survive real-world conditions. Add a heartbeat/liveness timeout so a sleeping phone or dropped Wi-Fi is detected rather than lingering as a phantom companion. Surface a drop with a toast + a "disconnected" badge on the peer. On reconnect, restore the device's surface role and pairing so picking the phone back up resumes the FPV where it left off (authority falls back to the survivor while a peer is gone — see #7). Provide an explicit unpair action.

### Acceptance criteria

- [ ] A heartbeat detects a dropped/sleeping companion within a bounded timeout instead of leaving it in presence.
- [ ] A peer drop shows a toast and a "disconnected" badge; the surviving device remains playable (authority fallback per #7).
- [ ] Reconnecting restores the device's surface role and pairing without losing the game seat.
- [ ] Re-pairing after a drop is quick and does not create a duplicate seat.
- [ ] An explicit unpair action cleanly ends the companion session and releases the companion surface.
