# #10 `BuildingLayer`: node footprints + labels + ~25 landmark names

**Phase:** 2 — Spatial Awareness  
**Type:** AFK  
**Blocked by:** #05

## What to build

Colored rectangle at every node position, node number label, real London names for ~25 landmark nodes. Makes locations feel like places.

## Acceptance criteria

- [ ] `BuildingLayer` Pixi `Container` at z-index 1 on `worldContainer`
- [ ] One colored rectangle per node, centered at x/y, with drop shadow
- [ ] Node number label below each rectangle
- [ ] `landmark-names.ts` maps ~25 node IDs to real London names (tube stations, bridges, squares)
- [ ] Landmark nodes show name prominently; node number secondary
- [ ] All 200+ nodes rendered without frame drops
