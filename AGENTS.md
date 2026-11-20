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

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
