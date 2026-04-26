# #21 60fps performance pass

**Phase:** 6 — Visual Polish  
**Type:** AFK  
**Blocked by:** #19, #20

## What to build

Verify and fix 60fps with all features active.

## Acceptance criteria

- [ ] Pixi ticker reads ≥ 58fps during normal gameplay with all layers active
- [ ] No drops during movement tweens, reveal sequence, or heatmap bloom
- [ ] Static layers (GroundLayer, BuildingLayer) cached: `cacheAsBitmap` or `RenderTexture`
- [ ] All GSAP tweens cleaned up on completion
- [ ] `ParticleContainer` used for footsteps and vehicles
- [ ] Brief `PERFORMANCE.md` in `apps/frontend-pixi` documents findings
