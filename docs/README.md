# Yard — Team Agreements & Architecture

## Branch Naming

```
feature/<issue-id>-short-description
bugfix/<issue-id>-short-description
chore/<issue-id>-short-description
```

Example: `feature/42-deduction-heatmap`

## Core Principles

- **Backend is in scope** — the backend (`apps/backend`) is a full part of the stack and may be modified when a feature calls for it (real-time coordination, presence, device pairing, etc.). Game-rule validation currently happens in the frontend; that is the present architecture, not a constraint. Coordinate any `shared-utils` / WebSocket-protocol change across both apps.
- **Deduction engine is first-class** — `shared-utils/src/lib/deduction-engine.ts` computes all possible Mr. X positions from public information. It is the source of truth for culprit tracking logic.
- **Render state pattern** — a render-state selector translates game state + deduction output into pure visual descriptions. The Pixi board reads render state only; it never imports from stores directly.
- **Shared utils are stable** — `shared-utils` types and the WebSocket protocol are the only contracts shared between frontend and backend. Changes here must be coordinated.

## Monorepo Commands

```bash
bun nx serve frontend-pixi      # dev server (port 4201)
bun nx serve backend            # backend (port 3000)
bun nx build frontend-pixi      # production build
bun nx test frontend-pixi       # unit tests
bun nx lint frontend-pixi       # ESLint
bun nx typecheck frontend-pixi  # tsc --noEmit
```

## Architecture Decision Records

All significant decisions are recorded in `docs/decisions/`.
