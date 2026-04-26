# frontend-pixi Issues

23 vertical slices. Architecture is **gameplay-first**: the deduction engine and correct game logic exist before a single pixel of Pixi is written.

## Phase 0 — Game Brain (logic before visuals)

| # | Issue | Blocked by |
|---|---|---|
| [00b](./00b-backend-strip-culprit-position.md) | **Backend:** strip culprit position from detective messages | — |
| [00](./00-websocket-store.md) | WebSocket manager + Zustand store + URL entry | — |
| [01](./01-render-state-selector.md) | Derived render-state selector | #00 |
| [02](./02-deduction-engine.md) | Deduction engine: possible Mr. X positions | #00, #00b |
| [03](./03-debug-panel.md) | Debug panel | #01, #02 |

> End of Phase 0: game logic correct and testable. Zero Pixi code.

## Phase 1 — Minimal Playable Board

| # | Issue | Blocked by |
|---|---|---|
| [04](./04-scaffold-nx-app.md) | Scaffold `frontend-pixi` Nx app | — (parallel with Phase 0) |
| [05](./05-pixi-canvas-camera.md) | Pixi canvas + `worldContainer` + camera | #04 |
| [06](./06-character-layer-placeholders.md) | `CharacterLayer`: placeholder circles | #05, #01 |
| [07](./07-valid-move-click.md) | Valid move glows + click-to-move + transport preview | #06 |
| [08](./08-react-hud.md) | React HUD: turn indicator + ticket counts | #00, #01 |

> End of Phase 1: fully playable (ugly) game.

## Phase 2 — Spatial Awareness

| # | Issue | Blocked by |
|---|---|---|
| [09](./09-ground-layer.md) | `GroundLayer`: roads, parks, Thames | #05 |
| [10](./10-building-layer.md) | `BuildingLayer`: node footprints + labels | #05 |
| [11](./11-heatmap-layer.md) | `HeatmapLayer`: possible Mr. X visualization | #09, #10, #02 |
| [12](./12-move-history-turn-timeline.md) | Move history drawer + turn timeline | #08 |

> End of Phase 2: game looks like a city; detectives have deduction tools.

## Phase 3 — Deduction UX (the differentiator)

| # | Issue | Blocked by |
|---|---|---|
| [13](./13-hover-simulation.md) | Hover simulation: preview post-move possible positions | #11, #02 |
| [14](./14-tension-systems.md) | Tension systems: search pressure + uncertainty spikes | #11 |

> End of Phase 3: game feels intelligent.

## Phase 4 — Animation & Drama

| # | Issue | Blocked by |
|---|---|---|
| [15](./15-gsap-movement-tweens.md) | GSAP character movement tweens | #06 |
| [16](./16-mr-x-reveal.md) | Mr. X reveal: camera pan + ripple | #15, #05 |
| [17](./17-game-end-invalid-move.md) | Game end overlay + invalid move feedback | #08 |

## Phase 5 — Replay & Insight

| # | Issue | Blocked by |
|---|---|---|
| [18](./18-replay-system.md) | Replay system: full game playback | #16, #02 |

## Phase 6 — Visual Polish

| # | Issue | Blocked by |
|---|---|---|
| [19](./19-character-sprites.md) | Top-down character sprites + walk cycle | #15 |
| [20](./20-environment-polish.md) | Animated Thames, vehicles, footsteps | #09, #15 |
| [21](./21-performance-pass.md) | 60fps performance pass | #19, #20 |

## Phase 7 — Release

| # | Issue | Blocked by |
|---|---|---|
| [22](./22-production-deployment.md) | Production deployment + manual testing | #21 |
