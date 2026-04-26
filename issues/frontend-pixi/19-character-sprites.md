# #19 Top-down character sprites + walk cycle

**Phase:** 6 — Visual Polish  
**Type:** AFK  
**Blocked by:** #15

## What to build

Replace placeholder circles with real top-down character sprites and 4-frame walk cycle animations.

## Acceptance criteria

- [ ] Sprite sheets exist for detective and Mr. X (top-down perspective)
- [ ] `CharacterLayer.setCharacter(role, sprite)` swaps circles for sprites — no structural changes
- [ ] 4-frame walk animation plays during GSAP movement tween; idle frame on stop
- [ ] Walk animation faces direction of movement (horizontal flip)
- [ ] Sprites loaded via `Assets.load()` with loading guard before board renders
- [ ] Placeholder circles fully removed
