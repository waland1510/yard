# Jev decides detective moves with a Choice primitive

Date: 2026-09-20
Status: accepted

## Context

The heuristic detective AI has a history of weak pursuit. We wanted a second,
independent decision source to compare against, using TypeSafe's Jev model, while
keeping the game fully playable with no API key.

Jev offers three primitives: Choice (one of a named set), Score (one item against
ordered levels), and Noul (yes/no probability).

## Decision

One **Choice** question per detective turn. The options are that detective's legal
moves, keyed `<transport>_<node>`.

Score was rejected: it rates a single `state` per request, so ranking N moves costs
N round trips inside the turn, and independent level ratings tie constantly, pushing
the real decision back into code. Choice is comparative by nature, returns a
probability per option (a free ranking for the debug comparison) plus a confidence,
and can only answer with one of our keys, so the returned move is legal by
construction.

Jev's documented weaknesses drive the prompt shape: it does not count, is "not a
calculator", and degrades on multi-hop reasoning. So **code computes, the model
judges**. Hop distances, suspect probability mass within one and two hops, node
degree, remaining tickets, and detective-collision filtering are all computed in
`move-candidates.ts` and written into each option's description as plain statements.
Jev never sees the raw graph.

## Consequences

- The heuristic always runs, so a missing key, an outage, or a timeout is a
  non-event. `AI_DETECTIVE_POLICY=heuristic` disables Jev without a deploy.
- Every AI detective turn emits an `AiDecisionComparison` (shared type) on the
  `makeMove` broadcast, surfaced in the debug overlay. This is debug telemetry and
  never an input to game rules.
- Cost is negligible (input $0.042 per million tokens, output free) and latency
  hides behind the existing two-second "AI thinking" delay.
- Whether Jev actually plays better is unmeasured. The overlay exists to answer
  that; if it does not, the honest outcome is to demote it to a tie-breaker over the
  heuristic's top candidates, or remove it.
