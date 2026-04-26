# #08 React HUD: turn indicator + ticket counts

**Phase:** 1 — Minimal Playable Board  
**Type:** AFK  
**Blocked by:** #00, #01

## What to build

CSS-positioned React overlay on the Pixi canvas. Turn indicator top-center, ticket counts bottom-center. Reads from Zustand directly.

## Acceptance criteria

- [ ] HUD container: `position: absolute; inset: 0; pointer-events: none`
- [ ] **Turn indicator** (top-center): "Your turn" or "[Role]'s turn", updates each turn
- [ ] **Ticket counts** (bottom-center): taxi / bus / underground counts with icons; culprit also shows secret + double
- [ ] Greyed out while WebSocket disconnected
- [ ] Interactive elements have `pointer-events: auto`
- [ ] No code from `apps/frontend`
