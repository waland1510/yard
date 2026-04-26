# #07 Valid move glows + click-to-move with transport preview

**Phase:** 1 — Minimal Playable Board  
**Type:** AFK  
**Blocked by:** #06

## What to build

On player's turn, pulse-glow valid destination nodes. When a node is clicked, auto-select transport (taxi → bus → underground) and show a small confirmation overlay near the node with the chosen transport and an override option. Confirm sends `makeMove`.

## Acceptance criteria

- [ ] `EffectLayer` Pixi `Container` at z-index 3 on `worldContainer`
- [ ] On `isMyTurn: true`, all `isValidMove: true` nodes show a pulsing glow (GSAP loop)
- [ ] Glows removed immediately when no longer player's turn
- [ ] Clicking a glowing node sets `pendingMove` in store (nodeId + auto-selected transport type)
- [ ] Small React overlay near the clicked node shows: chosen transport icon + override buttons for other available types + confirm button
- [ ] Confirming sends `{ type: 'makeMove', channel, role, position: nodeId, currentType: transport }` via WebSocket
- [ ] Clicking a non-glowing node during turn: red flash feedback (no move sent)
- [ ] `pendingMove` cleared on confirm, on cancel, or on turn end
- [ ] Unit test: transport auto-select logic given ticket counts + available edge types
