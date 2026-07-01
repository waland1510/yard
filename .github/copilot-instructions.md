# GitHub Copilot Instructions — Yard

Scotland Yard multiplayer board game. TypeScript monorepo (Bun + Nx).

## Active App

`apps/frontend-pixi` — Pixi.js v8 WebGL board, React 18 HUD, Zustand stores, Three.js 3D layer.

## Layer Rules (never bypass)

- **Render** (`src/hud/`, `src/three/`) — reads render-state only; never imports Zustand stores
- **Game Logic** (`src/core/`, `src/stores/`) — deduction engine, move validator, Zustand
- **Network** (`src/net/`) — WebSocket + REST, shapes events from backend
- **Shared** (`shared-utils/`) — grid map, deduction engine, types — shared by frontend + backend

## TypeScript

- No `any`, no `@ts-ignore`, no `console.log` in committed code
- Always `await` — no `.then()` chains for sequential logic
- `const` over `let`; no `var`
- Use path aliases: `@yard/shared-utils`

## React + Pixi

- Functional components, no class components
- `React.memo` for components reading from render-state
- Destroy Pixi app on unmount: `app.destroy(true, { children: true })`
- Dispose Three.js geometry and material on unmount

## Zustand

- One store per domain; actions inside `create()`
- Never mutate state directly — always `set()`
- Selectors as standalone functions

## Deduction Engine

- Lives in `shared-utils/src/lib/deduction-engine.ts`
- Called only from `deductionStore` — never from render components
- Changes require unit tests

## Backend (`apps/backend`)

- Fastify 5 + Drizzle ORM + PostgreSQL
- Do not modify unless the task explicitly requires it
- Parameterized queries only — no raw SQL string interpolation
- No secrets or API keys in code

## Testing

- Jest + React Testing Library
- Name: `<unit>_<scenario>_<expected>`
- Query by role first, then label, then `data-testid`
