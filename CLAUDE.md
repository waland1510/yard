# Yard — Claude Code

Scotland Yard multiplayer board game built as a TypeScript monorepo (Bun + Nx).

## Stack

- **Runtime**: Bun 1.2.1 / Node 22
- **Monorepo**: Nx 20 with Bun workspaces
- **Frontend (active)**: `apps/frontend-pixi` — Pixi.js v8 (WebGL), React 18, Zustand, Three.js
- **Frontend (legacy)**: `apps/frontend` — React + Chakra UI + SVG
- **Backend**: `apps/backend` — Fastify 5, Drizzle ORM, PostgreSQL (Neon), WebSocket
- **Shared**: `shared-utils` — grid map, deduction engine, TypeScript types

## Architecture

Three strict layers — never bypass them:

| Layer           | Path                                          | Rule                                                  |
| --------------- | --------------------------------------------- | ----------------------------------------------------- |
| **Render**      | `apps/frontend-pixi/src/hud/`, `src/three/`   | Pure visual — reads render-state only, no game logic  |
| **Game Logic**  | `apps/frontend-pixi/src/core/`, `src/stores/` | Deduction engine, move validation, Zustand state      |
| **Network**     | `apps/frontend-pixi/src/net/`                 | WebSocket + REST — shapes data into game events       |
| **Backend API** | `apps/backend/src/app/`                       | Fastify routes, AI helpers, DB access via Drizzle     |
| **Shared**      | `shared-utils/src/lib/`                       | Grid map, deduction logic, types — shared across apps |

**Backend is in scope**: `apps/backend` is a first-class part of the stack — modify it when a feature calls for it (e.g. real-time coordination, presence, device pairing). Game-rule validation currently lives client-side; treat that as the present architecture, not a prohibition. Coordinate any `shared-utils` / WebSocket-protocol change across frontend and backend. See `docs/README.md`.

## Key Instructions

@docs/instructions/index.md
@docs/instructions/typescript.md
@docs/instructions/react-pixi.md
@docs/instructions/backend.md
@docs/instructions/testing.md

## Agent OS

@docs/README.md
@docs/agents.md

## When in Doubt

Read `docs/README.md` or `docs/instructions/index.md` for navigation to all instruction files.

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
