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
DATABASE_URL         PostgreSQL connection string (Neon)
OPENROUTER_API_KEY   AI API key
GEMINI_API_KEY       AI API key (alternate provider)
TYPESAFE_API_KEY     Jev decision model key. Absent → Jev disabled, heuristic only.
AI_DETECTIVE_POLICY  choose | jev | heuristic (default: choose). `choose` offers disagreements to humans.
AI_CHOICE_TIMEOUT_MS How long a proposal waits for a human pick before the heuristic plays (default: 30000)
JEV_MODEL            Jev model id (default: jev-latest)
JEV_TIMEOUT_MS       Per-attempt timeout for a Jev call (default: 4000)
JEV_MIN_CONFIDENCE   Below this Jev confidence, fall back to the heuristic (default: 0)
FRONTEND_URL         Allowed CORS origin
HOST                 Server host (default: 0.0.0.0)
PORT                 Server port (default: 3000)
```

## Detective AI

Two policies decide detective moves. The heuristic always runs. When
`TYPESAFE_API_KEY` is set, a Jev policy runs concurrently. What happens next
depends on `AI_DETECTIVE_POLICY`:

- `choose` (default): if the two disagree, the server broadcasts an `aiProposal`
  with both moves and waits. Any human client answers with `aiChoice`; the first
  valid answer wins. With no answer by `AI_CHOICE_TIMEOUT_MS` the heuristic plays.
  Agreement, or Jev unavailable, commits automatically. A client joining
  mid-proposal receives the open proposal.
- `jev`: Jev's move is committed when it answers above `JEV_MIN_CONFIDENCE`.
- `heuristic`: Jev never runs.

Both picks travel to the client as `aiDecision` on the `makeMove` broadcast and
render in the Ctrl+D debug overlay. Never log the API key.

### Comparing deciders offline

`apps/backend/src/eval/` plays full games in memory with no database or socket.
Every arm gets the same seeded starting positions, so results are paired per seed.
Mr. X is always the existing culprit heuristic; arms differ only in detective play.

```bash
bun nx eval backend --args="--games 30 --arms legacy,heuristic,jev --out apps/backend/eval-results/run.json"
# or directly:
bun --env-file=apps/backend/.env.development run apps/backend/src/eval/run-ai-eval.ts --games 30
```

Arms: `legacy` (pre-policy greedy BFS), `heuristic` (candidate scoring), `jev`
(Jev with heuristic fallback; skipped without `TYPESAFE_API_KEY`). `--prior a,b,c`
overrides the deduction engine's flee prior for the heuristic and jev arms (see
`docs/decisions/2026-09-20-flee-prior-in-deduction-weights.md`). Reports win
rate, mean capture round, mean possible-set size after detective moves, and for
Jev the fallback rate, agreement with the heuristic, latency, and token cost.
Treat 30 games as a smoke test; differences under ~15 points need more seeds.

## Commands

```bash
bun nx serve backend     # dev with watch
bun nx build backend     # esbuild production bundle
bun nx test backend      # Jest unit tests
```
