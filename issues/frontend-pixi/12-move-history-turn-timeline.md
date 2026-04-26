# #12 Move history drawer + turn timeline

**Phase:** 2 — Spatial Awareness  
**Type:** AFK  
**Blocked by:** #08

## What to build

Two related HUD components: a collapsible move history drawer (Mr. X's public ticket log) and a turn timeline bar showing round numbers and upcoming reveal turn markers.

## Acceptance criteria

- [ ] **Move history drawer** (right edge, collapsible): lists each Mr. X move with turn number + ticket type; secret moves show "Secret"; updates in real time
- [ ] Drawer closed by default; animated slide in/out
- [ ] **Turn timeline** (visible in HUD): shows current round, total rounds, marks reveal turns (3, 8, 13, 18, 24) visually
- [ ] Next reveal turn highlighted/pulsing
- [ ] Works correctly for all roles (detectives see the log; Mr. X sees their own moves)
