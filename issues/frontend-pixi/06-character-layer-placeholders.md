# #06 `CharacterLayer`: placeholder circles at node positions

**Phase:** 1 — Minimal Playable Board  
**Type:** AFK  
**Blocked by:** #05, #01

## What to build

Render a colored circle per player using `RenderState.players`. Mr. X (`visible: false`) renders nothing. Positions come from node coordinates in `shared-utils`. Designed to swap circles for sprites in #20 without restructuring.

## Acceptance criteria

- [ ] `CharacterLayer` is a Pixi `Container` at z-index 2 on `worldContainer`
- [ ] One colored circle per player where `visible: true`
- [ ] 5 distinct detective colors + 1 distinct culprit color
- [ ] Circles centered at node x/y world coordinates
- [ ] Players with `visible: false` render nothing (Mr. X between reveals)
- [ ] Updates on `RenderState` change via Zustand subscription
- [ ] `CharacterLayer` exports a class/factory with a `setCharacter(role, sprite)` method — ready for sprite swap in #20
