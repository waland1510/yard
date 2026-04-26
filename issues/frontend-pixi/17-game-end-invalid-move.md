# #17 Game end overlay + invalid move feedback

**Phase:** 4 — Animation & Drama  
**Type:** AFK  
**Blocked by:** #08

## What to build

Two small interaction completions: the game end full-screen overlay, and the red flash on invalid move attempts.

## Acceptance criteria

- [ ] **Game end overlay:** appears when `gameStore.status` reaches terminal state; bold outcome text ("Detectives Win" / "Mr. X Escapes"); dimmed board behind; "Play Again" button; fade-in CSS transition
- [ ] **Invalid move flash:** red radial overlay on clicked node fades out over 0.3s (GSAP) when clicking a non-valid node during turn, or on server move rejection
- [ ] Both work independently of animation phase features
