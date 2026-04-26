# #03 Debug panel

**Phase:** 0 — Game Brain  
**Type:** AFK  
**Blocked by:** #01, #02

## What to build

A React overlay that lets developers verify game correctness without playing a full game. Toggled by a keyboard shortcut. Shows internal state that is normally hidden.

At the end of Phase 0, this panel + the unit tests are how you confirm the deduction engine and state pipeline are correct — before writing a single line of Pixi.

## Acceptance criteria

- [ ] Toggle on/off with `Ctrl+D` (or a visible dev button in non-production builds)
- [ ] Hidden in production builds (`import.meta.env.PROD`)
- [ ] Panel shows:
  - [ ] **Real Mr. X position** (from raw game store — only meaningful when running as culprit or in dev)
  - [ ] **Possible nodes count** and the full node ID list from deduction engine
  - [ ] **Current weights** (top 10 highest-probability nodes)
  - [ ] **Move history** (raw, including hidden culprit positions)
  - [ ] **Reveal turns** remaining
  - [ ] **WebSocket connection status**
- [ ] Panel does not interfere with board interaction (pointer-events: none on non-interactive areas)
