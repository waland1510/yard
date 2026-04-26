# #01 Derived render-state selector

**Phase:** 0 — Game Brain  
**Type:** AFK  
**Blocked by:** #00

## What to build

A pure selector that transforms raw Zustand game state into a flat `RenderState` object. The Pixi board and React HUD subscribe only to this — never to raw game state. This enforces the clean boundary between game logic and rendering.

## Acceptance criteria

- [ ] `getRenderState(gameState, deductionState): RenderState` is a pure function
- [ ] `RenderState` shape:
  ```ts
  type RenderState = {
    nodes: {
      id: number; x: number; y: number;
      isValidMove: boolean;
      possibleMrX: boolean;
      possibleMrXWeight: number; // 0–1
    }[];
    players: { role: string; nodeId: number; visible: boolean }[];
    activeTurn: string;
    isMyTurn: boolean;
    revealInProgress: boolean;
    lastKnownMrXNode: number | null;
    pendingMove: { nodeId: number; transportType: string } | null;
  }
  ```
- [ ] `isValidMove` computed from connection graph + active player's ticket counts
- [ ] Mr. X `visible: false` except on reveal turns (`showCulpritAtMoves` from `shared-utils`)
- [ ] `possibleMrX` and `possibleMrXWeight` populated from deduction engine output (can be empty set initially)
- [ ] `revealInProgress: true` on first render after crossing a reveal turn threshold
- [ ] Unit tests: given mock game state → expected render state for key scenarios
