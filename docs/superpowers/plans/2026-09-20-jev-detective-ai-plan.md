# Jev (TypeSafe System One) detective AI — design + implementation plan

Status: proposed, awaiting approval. No code written yet.

## Goal

Add a second, independent detective move decider backed by Jev
(`https://docs.typesafe.ai`). The game must keep working with no
`TYPESAFE_API_KEY` (zero Jev calls, current heuristic unchanged). When the key
is present, Jev is preferred for detective moves, the heuristic still runs as a
shadow, and the two decisions are compared and surfaced in the dev debug overlay.

Out of scope: AI culprit (disabled today), persisting comparisons to Postgres,
per-game runtime toggles, Jev for human-move hints.

## Facts from the Jev docs that shape the design

| Fact | Consequence |
|------|-------------|
| Three primitives: Choice (pick one of ≤255 unordered options, returns `choice`, `probabilities`, `confidence`), Score (rate one item on 2–10 ordered levels, one `state` per request, cannot score many items in one call), Noul (yes/no probability). | Choice fits "pick one of N candidate moves". Score would need one request per candidate. |
| "Jev is not a calculator", counting/arithmetic/date math are unreliable, multi-hop reasoning degrades accuracy, irrelevant state distracts. | All graph math (hop distances, suspect mass, ticket arithmetic, collisions) is computed in code and handed to Jev as precomputed facts. Jev only judges. |
| State may be a JSON object; docs recommend named fields. Options accept `{what, not_for, examples}` objects; instructions accept `{question, focus, note}`. | State = compact JSON of the tactical situation. Each candidate move = one Choice option with a `what` string built from precomputed features. |
| JS SDK: `npm install @typesafe-ai/sdk`, Node ≥ 20, `new TypeSafeClient()` reads `TYPESAFE_API_KEY`, `client.systemOne({ state, questions })`, helpers `choice()/score()/noul()`. REST: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer`. | Backend (Bun 1.2 / Node 22) can use the SDK directly. |
| Model ids `jev-latest` → `jev-1.13.0`. Limits 64k tokens/request, 32k for state. Rate 1,200 req/min. Errors 401/422/429/529, backoff on 429/529. Input $0.042 per 1M tokens, output free. | A move decision costs well under $0.0001. Latency is the only real cost. |
| Confidence = distribution sharpness (for 3 options `(3·pmax − 1)/2`). Docs: >0.9 act, <0.5 route elsewhere. Thresholds should scale with risk. | Confidence gating is available but a wrong detective move is low-risk, so default gate is off. |

## Decision: Choice, not Score

Recommendation: **one Choice question per detective turn, options = the
detective's legal moves.**

Why not Score:
- Score rates a single `state` against ordered levels. To rank N candidate moves
  you need N requests (docs: "cannot score multiple items in one call"). That is
  N× latency and N× cost inside the AI turn.
- Independent per-candidate scores on a 5-level rubric produce ties constantly
  (three moves all "level 3"); tie-breaking lands back in code, so Jev adds
  little over the heuristic.
- Score is designed for a spectrum ("how frustrated"), not for comparison
  between alternatives. Move selection is comparative by nature.

Why Choice:
- Legal detective moves are a small unordered set (typically 3–8, max ~13 on hub
  nodes). Well under 255.
- Returns a probability per option → a full ranking for free, which is exactly
  what the debug comparison needs ("where did the heuristic's pick land in Jev's
  ranking?").
- Returns `confidence` for optional fallback gating.
- Jev can only ever answer with one of our keys, so the move is legal by
  construction. No parsing of free text, unlike the OpenRouter/Gemini paths.

Not chosen but noted: a Noul fan-out ("should this detective block rather than
chase?") could later feed a strategy hint. YAGNI for v1.

## Architecture

All new backend code lives in `apps/backend/src/app/helpers/` next to the
existing AI helpers. Frontend work is confined to the existing `debug-overlay`
module plus a small store slice. One additive optional field on the
`makeMove` broadcast.

### Backend modules

```
helpers/
  ai-player.ts                 (modify) detective branch delegates to policy arbiter
  detective-policy.ts          (new)   DetectivePolicy interface + MoveDecision types
  heuristic-detective-policy.ts(new)   current calculateDetectiveMove, extracted, now also
                                       returns its ranked candidate list
  move-candidates.ts           (new)   pure: legal moves + precomputed features per move
  jev-detective-policy.ts      (new)   builds state + Choice question, calls SDK, maps back
  jev-client.ts                (new)   TypeSafeClient singleton, enabled() check, timeout
  ai-decision-arbiter.ts       (new)   runs heuristic (+ Jev when enabled) and picks;
                                       produces the comparison record
  env.ts                       (modify) TYPESAFE_API_KEY, AI_DETECTIVE_POLICY,
                                        JEV_MODEL, JEV_TIMEOUT_MS, JEV_MIN_CONFIDENCE
```

#### `move-candidates.ts` (pure, unit tested)

Input: `GameState`, detective `Player`, deduction output (`possible`, `weights`)
from `computePossiblePositions` (already used by the heuristic).

Output per legal move:

```ts
interface MoveCandidate {
  key: string;                 // e.g. "taxi_79"
  move: Move;                  // type, position, role
  destinationName: string;     // via mapData label if any, else "Junction #79"
  hopsToTopSuspect: number;    // bfs from destination to highest-weight node
  suspectMassWithin1: number;  // sum of weights of possible nodes within 1 hop of destination
  suspectMassWithin2: number;
  landsOnSuspect: boolean;     // destination ∈ possible
  exits: number;               // taxi+bus+underground degree of destination
  ticketAfter: number;         // remaining tickets of that transport after the move
  blockedByDetective: boolean; // another detective already stands there (excluded from options)
}
```

Blocked destinations are filtered out before they become Choice options, so
collision is enforced in code, not left to Jev.

#### `jev-detective-policy.ts`

State object (kept small, English, no raw graph):

```json
{
  "game": "Scotland Yard. You are a detective hunting Mr. X on a transport graph.",
  "round": 7,
  "nextRevealInRounds": 1,
  "detective": { "role": "detective2", "at": "Marylebone (#79)",
                  "tickets": { "taxi": 9, "bus": 7, "underground": 3 } },
  "otherDetectives": [ { "role": "detective1", "at": "#67" } ],
  "suspects": { "count": 6,
    "top": [ { "node": "#89", "probability": 0.31 }, { "node": "#105", "probability": 0.22 } ] },
  "lastRevealed": { "node": "#89", "roundsAgo": 4 }
}
```

Question:

```ts
choice(
  { question: "Which move should this detective make now?",
    focus: "Prefer moves that land on or tighten the net around the most probable Mr. X nodes while keeping the detectives spread out and conserving scarce underground tickets." },
  Object.fromEntries(candidates.map(c => [c.key, {
    what: `${c.move.type} to ${c.destinationName}. ${c.hopsToTopSuspect} hops from top suspect. ` +
          `Suspect probability within 1 hop: ${pct(c.suspectMassWithin1)}, within 2: ${pct(c.suspectMassWithin2)}. ` +
          `${c.landsOnSuspect ? 'Lands on a possible Mr. X node. ' : ''}` +
          `${c.exits} exits. ${c.ticketAfter} ${c.move.type} tickets left after.`
  }]))
)
```

Every number is precomputed and every comparison the model might need ("closest
to top suspect") is stated in words, per the jaggedness notes.

Returns `JevDecision | null`:

```ts
interface JevDecision {
  move: Move;
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
}
```

Failure handling: any thrown error, timeout (`JEV_TIMEOUT_MS`, default 4000),
or a `choice` key not in the candidate map → return `null` with an `error`
string on the comparison record. Never throw into the game loop. One retry on
429/529 only if it fits inside the timeout budget (SDK `RetryPolicy` if exposed,
else none).

#### `ai-decision-arbiter.ts`

```ts
interface DetectiveDecision {
  move: Move;
  source: 'jev' | 'heuristic';
  comparison: AiDecisionComparison;
}
```

Flow for a detective turn:
1. Compute candidates + deduction once (shared by both policies).
2. Heuristic always runs (sync, cheap). It returns its pick plus its ranked list.
3. If `jevEnabled()` (key present and `AI_DETECTIVE_POLICY !== 'heuristic'`),
   run Jev concurrently.
4. Pick Jev's move when it is non-null and `confidence >= JEV_MIN_CONFIDENCE`
   (default 0, meaning "prefer Jev whenever it answers"). Else heuristic.
5. Build `AiDecisionComparison`.

The `handleAIMove` 2-second "AI thinking" delay in `main.ts` becomes
`Promise.all([decide(), setTimeout(2000)])` so the Jev round-trip overlaps the
delay instead of adding to it.

`AIPlayerService.calculateMove` keeps its signature for callers/tests but gains
`calculateDetectiveDecision()` returning the full `DetectiveDecision`;
`main.ts` calls the new one.

### Shared contract (additive, needs coordination per `docs/agents.md`)

In `shared-utils/src/lib/shared-utils.ts`:

```ts
export interface AiDecisionComparison {
  role: RoleType;
  moveIndex: number;                       // index in game.moves after commit
  chosen: 'jev' | 'heuristic';
  agree: boolean;                          // same destination + transport
  heuristic: { move: Move; rankInJev: number | null };
  jev: {
    move: Move; confidence: number; model: string; latencyMs: number;
    top: Array<{ key: string; move: Move; probability: number }>;  // top 5
  } | null;
  jevError?: string;                       // present when Jev was enabled but failed
  jevEnabled: boolean;
}
```

`Message.data` gets `aiDecision?: AiDecisionComparison`. Optional field, no
existing consumer breaks. Not a `breaking_change`; still flagged
`needs_human: true` because it touches `shared-utils/src/lib/`.

### Frontend (`apps/frontend-pixi`)

- `net/websocket-client.ts`: pass `aiDecision` through `onMakeMove`.
- `stores/game-state-store.ts`: new `aiDecisions: AiDecisionComparison[]`
  (ring buffer, last 20), appended on `makeMove`, cleared on new game.
- `hud/debug-overlay.tsx`: new section "AI decisions" showing, for the latest
  entry per AI detective: chosen source badge, AGREE/DISAGREE, Jev confidence
  and latency, top-3 Jev candidates as probability bars with the heuristic pick
  marked, and the error string when Jev failed. Plus a running tally
  "agree 7 / 11" for the game. Overlay is already dev-only behind Ctrl+D.

No FPV/Three/Pixi changes. Render layer untouched.

### Config

```
TYPESAFE_API_KEY        absent → Jev fully disabled, no SDK calls, no network
AI_DETECTIVE_POLICY     jev | heuristic   (default: jev when key present)
JEV_MODEL               default jev-latest
JEV_TIMEOUT_MS          default 4000
JEV_MIN_CONFIDENCE      default 0
```

Document in `docs/instructions/backend.md` env table. Never log the key.

### Logging

Replace the `[Detective AI]` `console.log` lines in the touched code with
`fastify.log.info({ ai: comparison }, 'ai-decision')` (structured, per
`typescript.md` "no console.log"). Untouched culprit code left as is.

## Implementation steps

Each step is a small commit with green `bun nx test backend`.

1. **Extract heuristic** into `heuristic-detective-policy.ts` behind the
   `DetectivePolicy` interface; return `{ move, ranked }`. Existing
   `ai-player.spec.ts` / `ai-player-enhanced.spec.ts` must pass unchanged.
2. **`move-candidates.ts`** with tests:
   `moveCandidates_atHubNode_listsAllAffordableTransports`,
   `moveCandidates_destinationOccupiedByDetective_isExcluded`,
   `moveCandidates_landsOnSuspect_setsFlagAndMass`,
   `moveCandidates_noTickets_returnsEmpty`.
3. **Shared type** `AiDecisionComparison` + optional `Message.data.aiDecision`.
   Typecheck frontend, backend, shared-utils.
4. **`jev-client.ts` + `jev-detective-policy.ts`**, add `@typesafe-ai/sdk`.
   Tests mock the client: `jevPolicy_validChoice_returnsMappedMove`,
   `jevPolicy_unknownKey_returnsNull`, `jevPolicy_timeout_returnsNull`,
   `jevPolicy_noApiKey_neverCallsClient`, `jevPolicy_statePayload_containsNoRawGraph`.
5. **Arbiter** + `AIPlayerService.calculateDetectiveDecision`. Tests:
   `arbiter_jevDisabled_choosesHeuristicAndMarksJevEnabledFalse`,
   `arbiter_jevAnswers_prefersJev`,
   `arbiter_jevFails_fallsBackToHeuristicWithError`,
   `arbiter_belowMinConfidence_fallsBackToHeuristic`,
   `arbiter_sameMove_agreeTrueAndRankZero`.
6. **`main.ts`**: use the decision, overlap the 2s delay, attach `aiDecision`
   to the `makeMove` broadcast, structured log.
7. **Frontend**: websocket passthrough, store slice, debug overlay section.
   Component test `debugOverlay_withAiDecision_showsSourceAndAgreement`
   (RTL, query by role/text).
8. **Docs**: env table in `backend.md`; ADR
   `docs/decisions/2026-09-20-jev-choice-for-detective-moves.md` recording the
   Choice-over-Score decision and the code-computes/model-judges split.
9. **Manual verification**: run backend with and without the key, start a game
   with AI detectives, confirm moves resolve in both modes and the overlay shows
   comparisons; confirm no request leaves the box when the key is absent.

## Risks / open points

- **Jev quality on this task is unknown.** The comparison overlay exists
  precisely to measure it. If Jev disagrees with the heuristic often and loses
  games, flip `AI_DETECTIVE_POLICY=heuristic` without a deploy.
- **Latency.** Jev is fast but the 4s timeout plus 2s delay caps worst-case
  turn time at ~4s (they overlap). Acceptable for an "AI thinking" beat.
- **SDK on Bun.** SDK targets Node ≥ 20; backend runs under Node 22 via esbuild
  build so this should be fine. If the SDK misbehaves, `jev-client.ts` is the
  one file to swap for a plain `fetch` to `/v1/systemone`.
- **Shared-utils touch** is additive but per `docs/agents.md` needs a human
  nod before merge.
- **Persisting comparisons** for offline analysis (new table or JSON column on
  `moves`) is a natural follow-up, deliberately excluded here.
