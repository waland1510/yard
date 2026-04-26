# #18 Replay system: full game playback with Mr. X path reveal

**Phase:** 5 — Replay & Insight  
**Type:** AFK  
**Blocked by:** #16, #02

## What to build

Post-game playback that shows the full game turn-by-turn: Mr. X's actual path, what detectives suspected each turn (deduction engine state), and how reality diverged from suspicion.

## Acceptance criteria

- [ ] Full game timeline stored in client state throughout the game (turn snapshots: positions + deduction state)
- [ ] Accessible from the game end overlay ("Watch Replay" button)
- [ ] Replay mode renders the board in a scrubable timeline: prev/next turn buttons + turn slider
- [ ] Mr. X's actual path shown (all positions visible, regardless of role)
- [ ] Heatmap shown at each historical turn — "what detectives knew"
- [ ] Overlay annotation: actual Mr. X position vs suspected zone per turn
- [ ] Replay does not require any backend changes — built entirely from client-side timeline snapshots
- [ ] Exiting replay returns to the game end overlay
