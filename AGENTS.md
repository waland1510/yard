# Yard — OpenAI Codex CLI

Scotland Yard multiplayer board game. TypeScript monorepo (Bun + Nx).

## Stack

- **Runtime**: Bun 1.2.1 / Node 22
- **Monorepo**: Nx 20
- **Active frontend**: `apps/frontend-pixi` — Pixi.js v8, React 18, Zustand, Three.js
- **Backend**: `apps/backend` — Fastify 5, Drizzle ORM, PostgreSQL
- **Shared**: `shared-utils` — grid map, deduction engine, TypeScript types

## Architecture Layers

```
Render (hud/, three/)  ←  render-state only, no stores
Game Logic (core/, stores/)  ←  deduction, validator, Zustand
Network (net/)  ←  WebSocket + REST
Shared (shared-utils/)  ←  types + deduction engine (shared contract)
Backend (apps/backend/)  ←  do not touch unless task requires it
```

## Standards

Follow the standards in `docs/instructions/`:
- `typescript.md` — strict TypeScript rules
- `react-pixi.md` — layer contracts, Pixi/Three patterns
- `backend.md` — Fastify, Drizzle, WebSocket
- `testing.md` — Jest, naming, coverage targets

## Agent Orchestration

Follow the model in `docs/agents.md`. Personas are in `docs/instructions/personas/`.

## Hard Gates

- `shared-utils/src/lib/` changes → coordinate frontend + backend
- `apps/backend/` changes → explicit task requirement only
- Deduction engine changes → unit tests required before merge
- WebSocket protocol changes → confirm scope, flag `breaking_change: true`

## Commands

```bash
bun nx serve frontend-pixi    # dev server port 4201
bun nx serve backend          # backend port 3000
bun nx test frontend-pixi     # unit tests
bun nx build frontend-pixi    # production build
bun nx typecheck frontend-pixi
```
