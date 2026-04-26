# #04 Scaffold `frontend-pixi` Nx app with Pixi.js v8 + GSAP

**Phase:** 1 — Minimal Playable Board  
**Type:** AFK  
**Blocked by:** None — can start immediately (parallel with #00)

## What to build

Generate the Nx application shell. This can run in parallel with Phase 0 work — the app scaffold and the game brain are independent.

## Acceptance criteria

- [ ] `nx generate @nx/react:application frontend-pixi` with Vite bundler and Jest
- [ ] `pixi.js` v8 and `gsap` installed as workspace dependencies
- [ ] `nx serve frontend-pixi` runs on port 4201
- [ ] Single route `/game/:gameId` mounts a `<canvas>` placeholder
- [ ] `nx build frontend-pixi` produces a valid dist output
- [ ] No code copied from `apps/frontend`
