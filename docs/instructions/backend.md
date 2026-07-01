# Backend Standards

> **Note**: The backend is a first-class part of the stack — modify it when a feature calls for it, following the standards below. Game-rule validation currently lives client-side; that is the present architecture, not a prohibition on backend work. Any change to the WebSocket protocol or `shared-utils` contracts must be coordinated across frontend and backend.

## Fastify Routes

- One file per route group in `src/app/routes/`.
- Register plugins via `fastify.register()` — never mutate the fastify instance directly.
- Validate request bodies with JSON Schema via `schema: { body: ... }` on route options.
- Return typed responses — define a `Reply` type for each route.

## Drizzle ORM

- Schema definitions in `src/app/migrations/` — never auto-generate schema from the DB.
- Use `db.select()`, `db.insert()`, `db.update()`, `db.delete()` — no raw SQL unless unavoidable.
- Parameterized queries only — never string-interpolate user input into SQL.
- Transactions for multi-table writes: `db.transaction(async (tx) => { ... })`.

## WebSocket Protocol

- Event types are defined in `shared-utils` — add new events there first.
- Payload shape changes are a **breaking change** — flag `breaking_change: true` and coordinate frontend.
- Server emits events via `socket.send(JSON.stringify({ type, payload }))`.
- All WebSocket handlers are in `src/app/routes/ws.ts`.

## AI Helpers

- AI player logic lives in `src/app/helpers/`.
- OpenRouter API calls are wrapped with a fallback to local heuristic logic.
- Never expose the `OPENROUTER_API_KEY` in logs or responses.

## Environment Variables

```
DATABASE_URL      PostgreSQL connection string (Neon)
OPENROUTER_API_KEY AI API key
FRONTEND_URL      Allowed CORS origin
HOST              Server host (default: 0.0.0.0)
PORT              Server port (default: 3000)
```

## Commands

```bash
bun nx serve backend     # dev with watch
bun nx build backend     # esbuild production bundle
bun nx test backend      # Jest unit tests
```
