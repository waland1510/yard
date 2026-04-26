# PRD: Pixi.js Video Game Style Frontend

## Problem Statement

The current Scotland Yard game frontend uses SVG rendering for the game board, which provides a functional but static "map-like" experience. Players interact with abstract nodes and colored lines rather than feeling immersed in a living game world. The SVG approach limits visual polish, animation capabilities, and the ability to create a modern deduction game experience.

More critically: the existing frontend is purely a board renderer. It has no deduction layer — no system that tracks what detectives know, what positions are still possible, or how certainty evolves over the game. This is the real gap.

## Core Insight

> We're not building a board renderer. We're building a **deduction engine with a visual layer**.

The rendering is in service of the deduction experience — not the other way around. Everything visual exists to make information and uncertainty legible.

## Solution

Create `apps/frontend-pixi`: a Pixi.js (WebGL) frontend built gameplay-first. Architecture layers from the inside out:

1. **Deduction Engine** — computes all possible Mr. X positions from public information
2. **Game State Layer** — Zustand stores + WebSocket, source of truth
3. **Render State Selector** — translates game state + deduction output into a flat visual description
4. **Pixi Board** — renders the visual layer (top-down city, characters, effects)
5. **React HUD** — turn info, tickets, move history, deduction overlay controls

The game is playable (correctly) before it looks polished. Visual polish layers safely on top.

## Design Decisions (Resolved)

| Decision | Choice | Rationale |
|---|---|---|
| Entry point | URL params (`/game/:id?role=&name=`) | Board-first focus; setup screen deferred |
| Visual style | Top-down city blocks (grey roads, green parks, blue Thames) | Feels like real places, not a sky map |
| Camera | Free pan + scroll zoom + auto-focus (disabled after manual pan) | Standard video game navigation; doesn't fight user |
| Isometric effect | None | Rotation breaks hit detection; no visual gain |
| Location labels | Hybrid: ~25 landmarks named, rest show node number | Real-place feel without full data work |
| Loading state | Board visible immediately, HUD activates on WebSocket connect | City always exists |
| Player representation | Top-down sprites (Phase 1: colored circle placeholders) | Video game characters |
| Mr. X visibility | Invisible between reveal turns | Faithful to rules |
| Move selection | Click valid node → show chosen transport + allow quick override → confirm | Keep strategic depth, avoid silent decisions |
| HUD layout | React overlay on fullscreen Pixi canvas | Right tool for each job |
| Mr. X reveal | Camera pans + zooms to location, sprite slams in with ripple | Cinematic moment |
| Game end | Full-screen React overlay, replay button | Simple, effective |
| State flow | WebSocket → Zustand → derived render state → Pixi board | Clean separation of game logic and rendering |
| Code reuse | Only `shared-utils` data + WebSocket protocol | Clean-room design |
| Deduction engine | First-class system, not optional | Unlocks AI, hints, replay, heatmaps |
| Backend authority | Server is sole source of truth for valid moves, reveal rounds, hidden logs | Prevents desync bugs |

## Core Systems

### 1. Deduction Engine

The most important system in the codebase. Computes the set of all nodes Mr. X could currently be on, given only public information available to detectives.

```ts
type PossibleState = {
  round: number;
  possibleNodes: Set<number>;
};

function computePossiblePositions(
  moveHistory: Move[],        // public ticket log (no positions)
  revealHistory: Reveal[],    // position + round for each reveal
  graph: ConnectionGraph,     // from shared-utils
): PossibleState;
```

**Update logic per turn:**
1. Start from the last known position (reveal or game start)
2. For each ticket used since last known position, expand the set: `possibleNodes = all nodes reachable from any currentPossible via that ticket type`
3. On a reveal turn: reset `possibleNodes` to the single revealed node
4. On a double move: expand twice (set explodes — this is intentional, it's the mechanic)

**Why this matters:**
- Enables heatmap visualization (huge UX win for detectives)
- Foundation for an AI hint system
- Enables full post-game replay with "what detectives knew"
- Makes the game feel intelligent, not just animated

### 2. Render State

The Pixi board and React HUD subscribe only to `RenderState` — never to raw game state.

```ts
type RenderState = {
  nodes: {
    id: number;
    x: number;
    y: number;
    isValidMove: boolean;
    possibleMrX: boolean;      // is this node in the deduction engine's current set?
    possibleMrXWeight: number; // 0–1, normalized probability weight (for heatmap)
  }[];
  players: {
    role: string;
    nodeId: number;
    visible: boolean;
  }[];
  activeTurn: string;
  isMyTurn: boolean;
  revealInProgress: boolean;
  lastKnownMrXNode: number | null;
  pendingMove: {              // set when player has clicked a node but not confirmed
    nodeId: number;
    transportType: TransportType;
  } | null;
};
```

The Pixi board reads `possibleMrX` / `possibleMrXWeight` to render the heatmap. The board never computes game logic itself.

### 3. Tension Systems

**Search Pressure:** As detectives narrow down possible positions, the heatmap visually contracts. Detectives see progress. Mr. X sees the noose tighten (if dev mode is on). This mechanical tension is communicated visually.

**Uncertainty Spikes:** When Mr. X plays a double move, `possibleNodes` explodes. The heatmap suddenly blooms. This is intentional — it communicates why double moves are powerful without needing text explanation.

**Reveal Impact:** After a reveal, `possibleNodes` resets to one node. The heatmap collapses dramatically. This moment should be visually distinct (pulse inward rather than outward).

## User Stories

1. As a detective, I want to see a heatmap of where Mr. X might be, so that I can make informed deduction decisions rather than guessing blindly.

2. As a detective, I want the heatmap to update every turn based on which ticket Mr. X used, so that I can narrow down possibilities over time.

3. As a detective, I want to see the heatmap explode on a double move, so that I immediately understand why double moves are strategically powerful.

4. As a player, I want to see a top-down city board with real streets, parks, and the Thames, so that locations feel like actual places.

5. As a player, I want major landmarks to show their real London names, so that I can orient myself on the board.

6. As a player, I want to pan and scroll-zoom freely around the board, so that I can navigate at my preferred detail level.

7. As a player, I want the camera to focus on the active player's turn (unless I've manually panned), so that I stay oriented without losing camera control.

8. As a player, I want valid move nodes to pulse on my turn, with the chosen transport type shown before I confirm, so that I understand what move I'm committing to.

9. As a player, I want Mr. X to be invisible between reveal turns, so that hidden-movement tension is preserved.

10. As a player, I want the camera to dramatically reveal Mr. X's position on reveal turns, so that reveals feel like exciting cinematic moments.

11. As a player, I want a minimal HUD (turn, tickets, move history), so that I have necessary information without the board being obscured.

12. As a player, I want a turn timeline showing round numbers and upcoming reveal turns, so that I can plan around information timing.

13. As a player, I want to replay the full game after it ends — seeing Mr. X's actual path and how it compared to what detectives suspected — so that I can learn and discuss strategy.

14. As a player, I want to hover a potential move and see how it would affect the possible-position set, so that I can plan deductions ahead.

15. As a player, I want the game to end with a clear outcome overlay and replay option, so that the conclusion is impactful.

16. As a developer, I want a debug panel that shows real Mr. X position, possible nodes, and move logs, so that I can verify game correctness without watching a full game.

17. As a developer, I want the Pixi board to subscribe only to `RenderState`, so that rendering is fully decoupled from game rules.

18. As a developer, I want placeholder graphics swappable for sprites without code changes, so that visual upgrades don't require refactoring.

## Architecture

### Entry Point

Single route: `/game/:gameId?role=detective1&name=Alice`

Games created externally (existing SVG frontend or REST API). No setup screen in scope.

### Layer Hierarchy

```
WebSocket message
  → WebSocket manager (singleton, fresh implementation)
  → Zustand game store (raw game state — server is source of truth)
  → Deduction engine (pure function, subscribes to game store)
  → RenderState selector (game store + deduction output → RenderState)
  → Pixi board (subscribes to RenderState only)
  → React HUD (subscribes to Zustand + RenderState)
```

### Pixi Visual Layers (bottom to top)

1. `GroundLayer` — grey road polygons, green parks, blue Thames
2. `BuildingLayer` — colored node footprints, drop shadows, labels (~25 landmarks named)
3. `HeatmapLayer` — faint colored overlays on `possibleMrX` nodes, intensity by weight
4. `CharacterLayer` — player sprites (Phase 1: colored circles)
5. `EffectLayer` — valid move glows, reveal ripples, flash feedback
6. React HUD — CSS overlay: turn indicator, tickets, move history, turn timeline

### Camera

- `worldContainer` in Pixi; node coordinates from `shared-utils` used directly (1200×850 world units)
- Auto-fit on load: `scale = Math.min(screenW / 1200, screenH / 850)`
- Drag to pan, scroll to zoom
- Auto-focus on active player's turn — **disabled after manual pan**, re-enabled on turn end
- GSAP tweens via `camera.ts` module: `panTo(x, y, duration)`, `zoomTo(scale, duration)`

### Move Selection (updated)

1. Valid nodes pulse/glow on player's turn
2. Player clicks a node
3. App determines available transport types for that edge (from `shared-utils`)
4. **Auto-selects first available (taxi → bus → underground) but shows it in a small overlay near the node**
5. Player can tap a transport icon to override before confirming
6. Move commits on confirm (or after short delay if no override)
7. `makeMove` sent via WebSocket

### Backend Authority

The server is the sole source of truth for:
- Valid move set (client computes for UX preview; server validates)
- Reveal rounds (client uses `showCulpritAtMoves` constant from `shared-utils`)
- Mr. X's actual hidden position (never sent to detective clients)
- Move acceptance / rejection

The deduction engine runs client-side on public information only and can diverge from server ground truth only in ways visible to detectives (i.e. it represents detective knowledge, not actual state).

### Dependencies

**New packages:**
- `pixi.js` v8 — WebGL rendering
- `gsap` — tweens

**Existing (already in workspace):**
- `zustand` — state management
- `@yard/shared-utils` — map data, types
- React, Chakra UI — HUD

**Not in scope:**
- i18next — English only in Phase 1
- React Router — single route

## Project Phases

### Phase 0 — Game Brain (playable before it looks good)
- WebSocket manager + Zustand game store + URL entry
- Derived `RenderState` selector
- **Deduction engine**: `computePossiblePositions()` with full unit tests
- **Debug panel**: React overlay toggling real Mr. X position, possible nodes, move logs

> At end of Phase 0: game logic is correct and testable with zero Pixi code.

### Phase 1 — Minimal Playable Board
- Pixi canvas + `worldContainer` + camera (pan, zoom, auto-fit)
- Character layer: colored circle placeholders at node positions
- Valid move glows + click-to-move with transport preview + override
- React HUD: turn indicator, ticket counts
- Auto-focus camera on active player's turn

> At end of Phase 1: fully playable (ugly) game.

### Phase 2 — Spatial Awareness
- `GroundLayer`: roads, parks, Thames
- `BuildingLayer`: node footprints + labels + ~25 landmark names
- `HeatmapLayer`: possible Mr. X nodes rendered as faint highlights
- Integrate character positions with real map coordinates
- Move history collapsible drawer
- Turn timeline UI (round numbers, upcoming reveal markers)

> At end of Phase 2: game looks like a city; detectives have deduction tools.

### Phase 3 — Deduction UX (the differentiator)
- Hover simulation: hover a move → preview updated possible-position set
- Heatmap weight visualization (intensity by probability)
- Uncertainty spike on double move (heatmap bloom animation)
- Search pressure feedback (heatmap contracts as set narrows)

> At end of Phase 3: game feels intelligent.

### Phase 4 — Animation & Drama
- GSAP character movement tweens
- Mr. X reveal: camera pan + zoom + sprite slam + ripple
- Invalid move red flash feedback
- Auto-focus camera softened: disable after manual pan

### Phase 5 — Replay & Insight
- Full game timeline stored in client state
- Post-game replay: turn-by-turn playback, actual Mr. X path revealed
- "What detectives knew vs reality" overlay

### Phase 6 — Visual Polish
- Top-down character sprites (replace placeholder circles)
- Animated 4-frame walk cycle
- Animated Thames water
- Vehicle sprites on transport routes
- Footstep particle trails
- 60fps performance pass

### Phase 7 — Release
- Production backend connection + deployment
- Parallel SVG + Pixi manual testing

## Out of Scope

1. Setup / lobby screens — URL entry only
2. Isometric rotation — top-down only
3. i18n — English only in Phase 1
4. Magnify lens — not carried over
5. Sound effects / music
6. Mobile touch controls — desktop only
7. Backend changes — protocol unchanged
8. AI improvement — same AI backend
9. Shared library extraction — standalone app

## Technical Notes

- Pixi v8: `await Application.init({ resizeTo: window })`
- Deduction engine is a pure function — no Pixi, no React, no side effects. Import anywhere.
- Zustand stores work standalone (no React context required)
- GSAP tweens Pixi objects: `gsap.to(sprite, { x, y, duration: 0.4, ease: 'power2.out' })`
- `showCulpritAtMoves = [3, 8, 13, 18, 24]` from `shared-utils` — reveal round constants
- Camera fit: `scale = Math.min(screenW / 1200, screenH / 850)`
- Server validates all moves — client deduction engine represents detective knowledge only, not ground truth
