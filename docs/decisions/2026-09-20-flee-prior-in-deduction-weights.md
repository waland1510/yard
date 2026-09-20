# Deduction weights carry a flee prior

Date: 2026-09-20
Status: accepted

## Context

`computePossiblePositions` returns two things: the possible set (a hard constraint on
where Mr. X can be) and per-node weights (a belief about where he is). Until now the
belief spread each node's mass evenly across its exits, so four reachable underground
stations showed 25% each even when one was beside two detectives. The heatmap, the
heuristic's targeting, and the Jev prompt all read these weights as probabilities.

## Decision

`expandWeights` now shares a node's mass across its exits in proportion to a **flee
prior** indexed by hop distance from the exit to the nearest detective at the moment
Mr. X moves. The default is `[0.25, 0.6, 1]`: an exit beside a detective draws a
quarter of the mass a safe exit does, two hops away draws 60%. The possible set is
untouched, every reachable node keeps positive mass, and weights still sum to one.
Callers may pass `{ fleePrior }` to `computePossiblePositions`; `UNIFORM_PRIOR`
restores the old behaviour.

## Evidence

A 200-game paired sweep with the heuristic arm, same seeds throughout:

| prior | detective wins |
|---|---|
| uniform `[1]` | 81% |
| `[0.5, 0.8, 1]` | 78% |
| `[0.25, 0.6, 1]` (default) | 78% |
| `[0.1, 0.4, 1]` | 79% |
| `[0.25, 0.5, 0.8, 1]` | 80% |
| `[0.1, 1]` | 80% |

All within one standard error of each other (about 3 points at n=200). The prior makes
the displayed belief plausible without a measurable effect on capture rate against the
built-in culprit AI. It was adopted for the belief's honesty, not for strength.

## Consequences

- Heatmap and Jev prompt probabilities now reflect detective proximity.
- The strength is a guess about human play. The eval's `--prior` flag exists to retune
  it when there is human game data to tune against.
- The culprit AI flees at distance two, so a prior tuned to maximise capture rate here
  would overfit to it. That is why the sweep result was not used to pick a winner.
