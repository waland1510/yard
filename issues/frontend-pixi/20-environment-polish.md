# #20 Environment polish: animated Thames, vehicles, footsteps

**Phase:** 6 — Visual Polish  
**Type:** AFK  
**Blocked by:** #09, #15

## What to build

Three decorative environment effects that make the city feel alive. All purely cosmetic — no gameplay impact.

## Acceptance criteria

- [ ] **Animated Thames:** displacement filter or tiled animated texture replaces static blue polygon; subtle shimmer at 60fps
- [ ] **Vehicle sprites:** taxi/bus sprites loop along their respective routes using `ParticleContainer`; at least 3–5 visible at any time
- [ ] **Footstep trails:** particles emitted along path during character movement; fade over ~1s; `ParticleContainer`; cleaned up after fade; Mr. X footsteps only visible on reveal turns
- [ ] None of the three drop frame rate below 58fps
