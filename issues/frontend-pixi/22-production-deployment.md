# #22 Production deployment + parallel manual testing

**Phase:** 7 — Release  
**Type:** AFK  
**Blocked by:** #21

## What to build

Configure production environment and run a full manual test with SVG and Pixi frontends in the same live game.

## Acceptance criteria

- [ ] Env vars point to production backend (`https://yard-1.onrender.com`)
- [ ] `nx build frontend-pixi` produces clean production bundle
- [ ] Deployed to Vercel subdomain or separate project
- [ ] Manual test: SVG + Pixi clients in same game session — both receive moves in real time
- [ ] All roles tested: culprit + 2 detectives + AI player
- [ ] Mr. X reveal plays correctly
- [ ] Replay system works after game end
- [ ] No console errors in production build
