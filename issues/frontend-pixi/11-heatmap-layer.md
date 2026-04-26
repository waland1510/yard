# #11 `HeatmapLayer`: possible Mr. X node visualization

**Phase:** 2 — Spatial Awareness  
**Type:** AFK  
**Blocked by:** #09, #10, #02

## What to build

Render the deduction engine's output visually: faint colored overlays on all `possibleMrX` nodes, with intensity proportional to `possibleMrXWeight`. Toggle on/off. This is the detective's primary deduction tool.

## Acceptance criteria

- [ ] `HeatmapLayer` Pixi `Container` at z-index between BuildingLayer and CharacterLayer
- [ ] Each node in `possibleMrX: true` gets a colored radial overlay; alpha proportional to `possibleMrXWeight`
- [ ] Overlay color distinct from valid-move glow (e.g. orange/red vs green)
- [ ] Toggle button in React HUD shows/hides the heatmap layer
- [ ] On/off state persists across turns
- [ ] Heatmap updates every turn as deduction engine output changes
- [ ] Visible to detectives only (hidden when `role === 'culprit'`)
