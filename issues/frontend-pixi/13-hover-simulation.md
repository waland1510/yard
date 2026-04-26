# #13 Hover simulation: preview possible positions after move

**Phase:** 3 — Deduction UX  
**Type:** AFK  
**Blocked by:** #11, #02

## What to build

When a detective hovers a valid move node, temporarily compute and show what the deduction engine's possible-position set would look like *after* that move is made (given the auto-selected ticket type). The heatmap updates on hover, reverts on mouse-out.

## Acceptance criteria

- [ ] On hover of a valid-move node (during detective's turn), run deduction engine with the hypothetical move applied
- [ ] Heatmap updates to reflect the *post-move* possible set (not current)
- [ ] Visual distinction between current heatmap and hover-preview (e.g. dashed border on preview nodes)
- [ ] On mouse-out, heatmap reverts to current state immediately
- [ ] Hover preview only shown when heatmap toggle is on
- [ ] Computation is synchronous and fast (< 16ms to avoid frame drop) — deduction engine must be performant
- [ ] Does not trigger when it's not the local player's turn
