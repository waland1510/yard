# #00 WebSocket manager + Zustand game store + URL entry

**Phase:** 0 — Game Brain  
**Type:** AFK  
**Blocked by:** None — can start immediately

## What to build

Fresh WebSocket singleton, Zustand game store, and URL param parsing. No Pixi, no visuals — just the data pipeline from server to client state. The foundation everything else builds on.

## Acceptance criteria

- [ ] `websocket-manager.ts` — singleton, opens `ws://<host>/ws`, auto-reconnects after 5s on close
- [ ] Reads `gameId`, `role`, `name` from URL: `/game/:gameId?role=detective1&name=Alice`
- [ ] On connect sends `{ type: 'joinGame', channel: gameId, username: name, role }`
- [ ] Handles `updateGameState` → writes to Zustand store
- [ ] `useGameStore` holds: `players`, `moves`, `currentTurn`, `status`, `channel`
- [ ] Connection status (`connecting` / `connected` / `disconnected`) in store
- [ ] Store importable standalone — no React context required
- [ ] Unit tests: store state updates correctly on each message type
