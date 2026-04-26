# PRD: Pixi.js Video Game Style Frontend

## Problem Statement

The current Scotland Yard game frontend uses SVG rendering for the game board, which provides a functional but static "map-like" experience. Players interact with abstract nodes and colored lines rather than feeling immersed in a living game world. The SVG approach limits visual polish, animation capabilities, and the ability to create a cinematic video game feel that matches the tension of a cat-and-mouse chase through London.

## Solution

Create a separate frontend application (`frontend-pixi`) using Pixi.js (WebGL rendering) that transforms the game board from a static diagram into a stylized 3D video game world. The new frontend will feature:

- Textured ground and animated Thames river
- Building sprites at each node instead of numbered circles
- Animated vehicle sprites on transport routes (taxis, buses)
- Character sprites with walk animations for players
- Slight isometric camera angle with parallax depth
- Dynamic lighting, shadows, and ambient environmental effects
- Cinematic camera movements and dramatic reveal effects

Both frontends will remain functional and connect to the same backend, allowing users to choose between the classic SVG experience and the enhanced video game style experience.

## User Stories

1. As a player, I want to see a textured game board with streets and landmarks, so that I feel like I'm playing in a living London world rather than on a diagram.

2. As a player, I want to see building sprites at each location, so that I can recognize nodes as actual places rather than abstract numbered circles.

3. As a player, I want to see taxi and bus sprites moving along routes, so that the transport system feels alive and real.

4. As a player, I want to see animated character sprites for detectives and Mr. X, so that players feel like characters inhabiting the world rather than static pieces.

5. As a player, I want the board to have a slight isometric angle, so that the game world has depth and feels 3D rather than flat.

6. As a player, I want the camera to subtly pan with my mouse movement (parallax), so that I feel immersed in the game world.

7. As a player, I want valid move locations to pulse with glow effects, so that I intuitively know where I can move.

8. As a player, I want my character to smoothly glide to new positions when moving, so that movement feels weighty and intentional rather than instant teleportation.

9. As a player, I want to see footstep particles or trails when characters move, so that movement leaves a visual trace.

10. As a player, I want the Thames river to have animated water waves, so that the environment feels dynamic and alive.

11. As a player, I want streetlights or ambient glow at nodes, so that the board has atmospheric lighting.

12. As a player, I want dramatic reveal effects when Mr. X shows their position, so that reveals feel like exciting cinematic moments.

13. As a player, I want victory celebrations with screen effects (confetti, flash, text slam), so that winning feels impactful and celebratory.

14. As a player, I want the game to run smoothly at 60fps, so that animations and interactions feel responsive and polished.

15. As a player, I want to join games and play with the same functionality as the SVG frontend, so that I have full feature parity.

16. As a player, I want to use the same game setup flow, ticket management, and move history, so that the core gameplay is familiar.

17. As a player, I want the magnify lens feature, so that I can zoom in on board areas for easier navigation.

18. As a player, I want invalid moves to show red flash + shake feedback, so that I get clear error feedback.

19. As a player, I want to play against AI or human opponents with the same WebSocket real-time sync, so that multiplayer works identically.

20. As a player, I want all translations (en, fr, ja, pl, ua) available, so that I can play in my preferred language.

21. As a developer, I want both frontends to connect to the same backend, so that I can test them in parallel with real games.

22. As a developer, I want the Pixi board code organized in deep modules with testable interfaces, so that I can verify rendering logic in isolation.

23. As a developer, I want to be able to swap placeholder assets with polished assets later, so that visual upgrades don't require code changes.

## Implementation Decisions

### Architecture

**New Nx Application:** `apps/frontend-pixi`
- Generated with `@nx/react:application`
- Vite bundler, Jest unit testing
- Runs on separate port (4201) from SVG frontend (4200)
- Independent deployment target

**Code Sharing Strategy:** Copy-first, extract-later
- Initial implementation copies stores, hooks, i18n, UI components from `frontend`
- After feature parity, extract shared code to `libs/` for consolidation

### Pixi.js Board Architecture

**Layer Hierarchy (bottom to top):**
1. `GroundLayer` — Tiled texture for streets, parks, Thames (animated water shader)
2. `RoadLayer` — Textured roads along transport connections
3. `BuildingLayer` — Building sprites at each node with drop shadows
4. `VehicleLayer` — Animated taxi/bus sprites moving along routes
5. `CharacterLayer` — Player character sprites with walk animations
6. `EffectLayer` — Particle effects, highlights, spotlights, footstep trails
7. `UILayer` — React/Chakra overlays (ticket counter, move history)

**Camera System:**
- Root `world` container with slight rotation (~3° for isometric feel)
- `camera` container inside world for pan/zoom control
- Parallax: camera offset tracks mouse position at 2% sensitivity
- Dynamic zoom: slight zoom-in on player's turn

**State Management:**
- Zustand stores copied from existing frontend
- Direct subscription pattern: Pixi component subscribes to store, updates Pixi objects imperatively
- No React renderer for Pixi — ref-based imperative initialization

**Animation System:**
- GSAP for all tweens (character movement, highlights, camera transitions)
- Pixi `AnimatedSprite` for character walk cycles
- Pixi `ParticleContainer` for effects (footsteps, confetti, reveals)

### Asset Strategy

**Phase 1 (MVP):** Placeholder geometry
- Buildings: Colored rectangles with drop shadows
- Vehicles: Colored circles/rectangles
- Characters: Simple animated shapes
- Ground: Solid color or simple tiled pattern

**Phase 2 (Polish):** Replace with sprite assets
- Buildings: 5-10 building variants + 3-4 landmark sprites
- Vehicles: Top-down taxi, bus, train sprites (~16x16px)
- Characters: 4-frame walk cycle sprite sheets for detective and Mr. X
- Ground: Textured tiles (cobblestone, asphalt, grass, water)

**Asset Sources:** AI generation, asset store packs, or custom art (decision deferred)

### Dependencies

**New packages:**
- `pixi.js` (v8.x) — WebGL rendering engine
- `gsap` — Animation/tween system

**Existing packages (no new installs):**
- `zustand` — State management
- `@yard/shared-utils` — Map data, game types
- React, Chakra UI, i18next — UI shell

### WebSocket & Game Logic

- Copy `useWebSocket` hook and `websocket-manager.ts` as-is
- Same event protocol: `startGame`, `joinGame`, `makeMove`, `updateGameState`
- Copied Zustand stores: `useGameStore`, `useRunnerStore`
- Copied subscriptions: `usePlayerSubscription`, `usePlayersSubscription`

### UI Shell

- React Router for navigation (`/` setup, `/game/:gameId` game)
- Chakra UI components copied from existing frontend
- Setup screens: choose role, player count, AI configuration
- Game HUD: ticket counters, turn indicator, move history panel
- Pixi canvas embedded in game page alongside Chakra UI panels

### i18n

- Copy `i18n.ts` configuration and `locales/` folder
- Same 5 languages: en, fr, ja, pl, ua
- `useTranslation` hook works identically

### Testing Strategy

**Unit Tests (Jest):**
- Game logic (stores, hooks, WebSocket handling)
- Move validation logic
- State transformation functions

**Manual Testing:**
- Visual verification of Pixi rendering
- Side-by-side comparison with SVG frontend
- Parallel play: SVG and Pixi clients in same game

**Deferred:**
- Pixi rendering tests (requires canvas mocking infrastructure)
- Visual regression tests (requires Playwright setup)

### Build & Deployment

- `nx build frontend-pixi` → `dist/apps/frontend-pixi`
- Separate Vercel project or subdomain for deployment
- During development: `nx serve frontend-pixi` on port 4201

### Technical Clarifications

- Pixi v8 uses new `Application.init()` async initialization pattern
- Pixi `Graphics` API differs from SVG path syntax — manual path translation required
- Zustand works standalone without React — stores can be imported and subscribed directly
- GSAP works with Pixi objects: `gsap.to(sprite, { x, y, duration })`
- Pixi filters (blur, glow) are GPU-accelerated, unlike SVG filters

## Testing Decisions

### What Makes a Good Test

- Test external behavior, not internal Pixi rendering details
- Test game logic purity: given state X, output should be Y
- Test WebSocket event handling: on event E, state should update to S
- Do NOT test Pixi object creation directly (implementation detail)

### Modules to Test

1. **Stores** — State updates, selectors, subscriptions
2. **WebSocket Manager** — Connection, event emission, reconnection logic
3. **Move Validation** — `isMoveAllowed`, `getAvailableType` functions
4. **Game Logic** — Turn management, victory conditions
5. **State Transformers** — Game state → render data conversion functions

### Prior Art

- Existing Jest tests in `apps/frontend/src/` for stores and hooks
- `shared-utils` has utility function tests
- Pattern: Arrange-Act-Assert with Jest + React Testing Library

### Out of Scope for Testing

- Pixi rendering correctness (manual verification)
- Animation timing (GSAP internal behavior)
- Asset loading (assumed working)

## Out of Scope

The following are explicitly **out of scope** for this PRD:

1. **Full 3D rendering** — Three.js isometric board with true 3D models
2. **Day/night cycle** — Dynamic lighting changes based on game time
3. **Weather effects** — Rain, fog, snow overlays (infrastructure for water shader is in-scope)
4. **Custom asset creation** — Placeholder geometry is in-scope; polished art assets are Phase 2
5. **Sound effects / music** — Audio system not included
6. **Mobile touch controls** — Desktop mouse interaction only
7. **Accessibility features beyond existing** — Match current frontend a11y, no new features
8. **Backend changes** — All WebSocket events and database schema remain unchanged
9. **AI improvement** — AI logic unchanged; Pixi frontend uses same AI backend
10. **Extracting shared libraries** — Copy-first approach; library extraction is follow-up work
11. **Visual regression testing** — Manual testing for V1
12. **Performance optimization** — Baseline Pixi performance is sufficient; optimization is follow-up

## Further Notes

### Project Phases

**Phase 1: Scaffolding (Week 1)**
- Generate Nx app, install dependencies
- Copy stores, hooks, i18n, UI components
- Basic routing and WebSocket connection

**Phase 2: Board Foundation (Week 2)**
- Pixi Application initialization
- Layer container hierarchy
- Ground texture and river rendering

**Phase 3: Video Game Elements (Week 3)**
- Building sprites at nodes
- Road textures on connections
- Vehicle sprites on routes

**Phase 4: Characters & Animation (Week 4)**
- Character sprite sheets
- Walk cycle animations
- Movement tweens with GSAP

**Phase 5: Polish & Effects (Week 5)**
- Particle effects (footsteps, reveals, victory)
- Camera parallax and dynamic zoom
- Highlight effects, dramatic reveals

**Phase 6: Parity & Testing (Week 6)**
- Full feature parity with SVG frontend
- Manual testing, bug fixes
- Documentation

### Asset Pipeline Notes

Assets should be loaded via Pixi's `Assets` loader with a loading screen:
```ts
await Assets.load([
  '/assets/ground.png',
  '/assets/buildings.png',
  '/assets/characters.png',
  '/assets/vehicles.png',
]);
```

Placeholder assets can be generated programmatically with Pixi `Graphics` during development.

### Performance Considerations

- Use `ParticleContainer` for high-count elements (particles, vehicles)
- Batch static elements into textures where possible
- Limit GSAP tweens to active animations (cleanup on complete)
- Monitor frame rate with Pixi's built-in FPS meter during development

### Future Enhancements (Post-V1)

- Extract shared code to `libs/game-state`, `libs/ui-components`
- Add visual regression tests with Playwright
- Shader-based effects (water waves, fog, lighting)
- Replace placeholder assets with polished art
- Optional: 3D camera rotation, zoom controls
- Optional: Sound effects and background music
