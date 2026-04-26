# #09 `GroundLayer`: roads, parks, Thames

**Phase:** 2 — Spatial Awareness  
**Type:** AFK  
**Blocked by:** #05

## What to build

Draw the city ground plane with Pixi `Graphics`: grey roads along connections, green park shapes, blue Thames polygon. Bottom-most layer, drawn once on init.

## Acceptance criteria

- [ ] `GroundLayer` Pixi `Container` at z-index 0 on `worldContainer`
- [ ] Roads: grey thick lines along all connections from `shared-utils`
- [ ] Thames: blue filled polygon along river node coordinates
- [ ] Parks: green filled shapes at appropriate board regions
- [ ] Static — drawn once, not per-frame
- [ ] Visually distinct: roads grey, parks green, Thames blue
