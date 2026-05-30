# frontend-pixi — performance notes

## Caching strategy

- **GroundLayer** (roads, parks, Thames base, transport-coloured connections) renders once into a `RenderTexture` at boot and is shown via a single `Sprite` thereafter. All ~600 connections + park ellipses + transport overlays draw one time.
- **BuildingLayer** (footprints + drop shadows + node numbers + ~25 landmark labels) is also rendered once into a `RenderTexture`. Even with ~200 nodes and Text objects, the per-frame cost becomes a single sprite blit.
- **HeatmapLayer** (`zIndex 1.5`) maintains a pooled `Graphics` per touched node; new nodes are added lazily and old nodes are hidden via `scale -> 0` rather than destroyed, so churn is minimal even with bloom/contraction animations.
- **VehicleLayer** uses lightweight `Graphics` rectangles. (Issue #20 mentioned `ParticleContainer` — kept simple here because the count is small (≤ 7); `ParticleContainer` is a follow-up swap if needed.)
- **FootstepLayer** spawns 5 short-lived dots per move and destroys them after fade. Movement happens at most ~once/sec, so allocation pressure is bounded.
- **Thames shimmer** redraws three sin-wave polylines per frame on a dedicated `Graphics`. Cost is negligible (< 100 line segments).

## GSAP discipline

- Tweens are killed before retargeting in: camera (`gsap.killTweensOf(world)` on manual drag), characters (`gsap.killTweensOf(sprite)` before retargeting), heatmap blobs (`gsap.killTweensOf(blob.g.scale)` per update), effects (per node graphic).
- Reveal cinematic uses a single `gsap.timeline` with `onComplete` that restores camera state.
- Footstep fades use `onComplete` to `destroy()` so no leaked display objects accumulate.

## Known follow-ups

- Replace `Graphics` vehicles with `ParticleContainer` + sprites if the vehicle count is increased.
- If the building-layer Text count becomes a startup cost issue, batch into pre-rasterised atlas.
- Add a Pixi DevTools-driven FPS HUD if regressions are spotted.
