# #15 GSAP character movement tweens

**Phase:** 4 — Animation & Drama  
**Type:** AFK  
**Blocked by:** #06

## What to build

Animate character movement smoothly with GSAP instead of snapping.

## Acceptance criteria

- [ ] On player position change, character tweens from old x/y to new x/y: `gsap.to(sprite, { x, y, duration: 0.4, ease: 'power2.out' })`
- [ ] Previous tween killed before starting a new one
- [ ] Works for all players (local and remote)
- [ ] No animation on initial game state load (first position set is instant)
- [ ] No dangling GSAP instances after tween completes
