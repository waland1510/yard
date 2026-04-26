# #05 Pixi canvas, `worldContainer`, camera controls

**Phase:** 1 — Minimal Playable Board  
**Type:** AFK  
**Blocked by:** #04

## What to build

Initialize Pixi, mount the canvas fullscreen, create `worldContainer`, and implement the camera: auto-fit on load, drag to pan, scroll to zoom. Auto-focus on active player — disabled after manual pan, re-enabled on turn end.

## Acceptance criteria

- [ ] `await Application.init({ resizeTo: window })` initializes cleanly
- [ ] `worldContainer` on stage; all game layers attach here
- [ ] Auto-fit on load: `scale = Math.min(screenW / 1200, screenH / 850)`, centered
- [ ] Drag pans `worldContainer.x/y`; scroll wheel zooms `worldContainer.scale` (clamped)
- [ ] `camera.ts` module exports `panTo(x, y, duration)` and `zoomTo(scale, duration)` GSAP helpers
- [ ] Auto-focus: on `activeTurn` change, camera pans to active player's node (slight zoom-in ~20%)
- [ ] Auto-focus **disabled** after user manually drags; re-enabled at turn end
- [ ] Canvas stays fullscreen on window resize
