# #02 Deduction engine: possible Mr. X positions

**Phase:** 0 — Game Brain  
**Type:** AFK  
**Blocked by:** #00

## What to build

The brain of the game. A pure function that computes all nodes Mr. X could currently occupy, given only information publicly available to detectives: the ticket type used each turn and periodic reveals.

This unlocks heatmaps, AI hints, hover simulation, replay analysis, and correct uncertainty feedback — all for free.

## Acceptance criteria

- [ ] `computePossiblePositions(moveHistory, revealHistory, graph): PossibleState` is a pure function with no side effects
- [ ] Types:
  ```ts
  type PossibleState = {
    round: number;
    possibleNodes: Set<number>;
    weights: Map<number, number>; // nodeId → 0–1 normalized probability
  };
  ```
- [ ] **Initialization:** starts from last reveal position (or all valid starting nodes if no reveal yet)
- [ ] **Per turn update:** for each ticket used, expand set to all nodes reachable from any current possible node via that transport type
- [ ] **On reveal turn:** reset `possibleNodes` to the single revealed node; weights reset to `{ revealedNode: 1 }`
- [ ] **Double move:** expand set twice consecutively (set grows large — this is correct, it's the mechanic)
- [ ] **Secret ticket:** expand across all transport types (taxi + bus + underground)
- [ ] Weights computed as uniform distribution across `possibleNodes` (equal probability per node)
- [ ] Comprehensive unit tests covering: normal moves, reveal reset, double move expansion, secret ticket, multi-turn accumulation
- [ ] Runs in < 5ms per update (connection graph has ~200 nodes, ~600 edges)
