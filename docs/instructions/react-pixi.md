# React + Pixi.js + Three.js Standards

## Layer Contracts

| Layer | Path | What it can import |
|-------|------|--------------------|
| Render (Pixi/Three) | `src/hud/`, `src/three/` | Render-state types only — no stores, no core logic |
| HUD (React) | `src/hud/` | Zustand stores (read), render-state selector |
| Game Logic | `src/core/`, `src/stores/` | shared-utils, net layer events |
| Network | `src/net/` | shared-utils types, backend WebSocket protocol |

**Never import a store directly into a Pixi/Three component.** Pass data through the render-state selector.

## React Components

- Functional components only, no class components.
- Use `React.memo` for components that receive stable props from the render-state selector.
- Event handlers go in the HUD layer, not in Pixi display objects.
- Use `useCallback` for handlers passed as props to memoized children.

## Zustand Stores

- One store per domain: `gameStore`, `deductionStore`, `settingsStore`.
- Actions are defined inside `create()` — no external action files.
- Selectors are defined as standalone functions, not inline in `useStore()` calls.
- Never mutate state directly — always use `set()`.

## Deduction Engine

- The deduction engine lives in `shared-utils/src/lib/deduction-engine.ts`.
- Call it from `deductionStore` only — never from a render component.
- Its output (`possiblePositions: Set<number>`) feeds the heatmap render-state.
- Changes to the deduction engine require unit tests before merging (hard gate).

## Pixi.js

- Create Pixi objects in `onMount`/`useEffect` with cleanup.
- Prefer `Graphics` for board elements; use `Sprite` only for raster assets.
- Use Pixi's ticker for animation, not `setInterval` or `requestAnimationFrame` directly.
- Destroy Pixi app in cleanup: `app.destroy(true, { children: true })`.

## Three.js

- Three.js scene lives in `src/three/` — separated from 2D board.
- Dispose geometries and materials on unmount: `geometry.dispose()`, `material.dispose()`.
- Use `useRef` for the renderer and scene — never store Three objects in React state.

## React Health

Before committing React changes, run `/doctor` (or `npx react-doctor@latest --verbose --diff`) to catch regressions. Fix errors before warnings. Do not commit if the health score drops.

## Styling

- Tailwind for HUD layout.
- No inline styles except dynamic values (e.g., computed position/opacity from render state).
- Dark theme is the default — do not hard-code light-mode colors.
