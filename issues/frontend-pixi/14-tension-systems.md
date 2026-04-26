# #14 Tension systems: search pressure + uncertainty spikes

**Phase:** 3 — Deduction UX  
**Type:** AFK  
**Blocked by:** #11

## What to build

Two visual feedback systems that communicate mechanical tension through the heatmap:

**Search Pressure:** as the possible-node set shrinks over turns, the heatmap visually contracts — detectives see their progress closing in.

**Uncertainty Spikes:** on a double move, the possible-node set explodes. The heatmap blooms outward with an animation. On a reveal, it collapses to a single point.

## Acceptance criteria

- [ ] **Contraction feedback:** when `possibleNodes.size` decreases turn-over-turn, nodes exiting the set fade out with a shrink animation (GSAP scale 1 → 0 on removal)
- [ ] **Bloom animation:** when a double move causes `possibleNodes.size` to grow significantly (> 2x), new nodes pulse in with a radial bloom effect
- [ ] **Collapse animation:** on reveal turn, all heatmap nodes shrink to zero except the revealed node, which pulses brightly
- [ ] Animations don't block input — run concurrently with normal turn flow
- [ ] Animations have a max duration of 1s so they don't feel slow
