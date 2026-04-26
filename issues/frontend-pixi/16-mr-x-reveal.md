# #16 Mr. X reveal: camera pan + zoom + sprite slam + ripple

**Phase:** 4 — Animation & Drama  
**Type:** AFK  
**Blocked by:** #15, #05

## What to build

Cinematic reveal sequence triggered on turns 3, 8, 13, 18, 24. Camera pans and zooms to Mr. X's location, sprite slams in, ripple expands, camera returns.

## Acceptance criteria

- [ ] Triggered when `RenderState.revealInProgress` transitions to `true`
- [ ] GSAP timeline sequence:
  1. Camera pans + zooms to Mr. X's node (~0.8s, `power2.inOut`)
  2. Mr. X sprite fades in with scale punch (0 → 1.2 → 1.0)
  3. Pixi `Graphics` ripple expands from node center and fades out
  4. Camera tweens back to full-board view after 2s
- [ ] Player input blocked during sequence
- [ ] Mr. X sprite remains visible after sequence ends
- [ ] Does not trigger on game load — only on turn-threshold crossings
- [ ] Heatmap collapses to single node during reveal (coordinates with #14)
