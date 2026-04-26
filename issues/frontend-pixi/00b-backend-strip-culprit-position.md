# #00b Backend: strip culprit position from detective `updateGameState` messages

**Phase:** 0 — Game Brain (prerequisite)  
**Type:** AFK  
**Blocked by:** None — can start immediately

## What to build

The backend currently broadcasts a single `updateGameState` message to all clients in a channel, including the culprit's real `position` in `GameState.players`. Detective clients receive this but currently ignore it. 

This must change: the deduction engine's value depends on detectives not having access to the real position. Personalize the broadcast so detective clients receive `position: null` (or omit the field) for the culprit player.

## Acceptance criteria

- [ ] When broadcasting `updateGameState`, the server iterates per-connection rather than broadcasting a single payload
- [ ] For connections where `role !== 'culprit'`: culprit player's `position` is set to `null` (or `0`) in the outgoing payload
- [ ] For the culprit's own connection: full `position` is sent as normal
- [ ] Reveal turns are unaffected — the reveal mechanism already handles showing the position at the right moment via the `showCulpritAtMoves` constant on the client
- [ ] All existing game behavior unchanged for all roles
- [ ] Verified: detective client WebSocket message contains `position: null` for culprit player between reveals
