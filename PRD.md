# PRD: Scotland Yard — First-Person Video Game

## Problem Statement

I want to play Scotland Yard as a video game, not a board game.

The existing app at `apps/frontend` works correctly — it has all the game mechanics, theme support (classic London + Harry Potter), AI players, deduction tooling, magnify, replay, victory screens — but it *feels* like a static map. Players interact with abstract SVG nodes and colored lines. There is no sense of place, no sense of presence, no immersion.

A first-person prototype was started at `apps/frontend-pixi` (now Three.js, not Pixi). It validates the right visual direction: I stand at a London intersection in first-person, look around with the mouse, see a yellow taxi at one curb / red double-decker at another / underground entrance with a glowing "U" sign down the stairs / river ferry at the dock. Click a vehicle in my crosshair and a cinematic ride carries me to the next intersection. A diegetic A-Z paper map opens on TAB so I can see the whole London graph and plan.

But the prototype is *just* the visuals. It has none of the game underneath: no real multiplayer, no AI, no themes, no setup flow, no secret/double/river tickets, no reveal rounds, no deduction surfacing, no move history, no victory screen, no magnify, no replay, no edge-case handling. If I shipped it today I would lose every feature the SVG app already has — and I would notice the loss every time I played.

The job is to build out `frontend-pixi` to full feature parity with `frontend`, in the new FPV architecture, with the new FPV-specific affordances on top — so that taking a turn as a detective answers, in one place: *what can I take here, where does each option go, where are the other detectives, where was Mr. X last seen, am I about to land on a teammate, can I catch him in one move, and what does my plan look like on the map?* — without ever leaving first-person except by explicit choice.

## Solution

Promote `apps/frontend-pixi` to a complete game by building 24 deep modules, organized in four bands:

1. **Pure-logic core** (no React, no Three.js, no I/O) — `map-data`, `move-validator`, `deduction-engine`, `theme-registry`, `replay-controller`. Every game rule lives here. Each is a single-file deep module with a small interface and a large amount of encapsulated logic. The rest of the system reads results from these modules; nothing else makes game decisions.
2. **State + I/O adapters** — `game-state-store`, `runner-store`, `websocket-client`, `rest-client`, `url-params-router`, `geo-greeting-service`, `i18n-service`, `notification-service`, `audio-bus`. These bridge the network and browser to the rest of the app. They speak to the core modules but contain no game rules themselves.
3. **3D world** (Three.js) — `world-scene`, `intersection-builder`, `vehicle-spawner`, `ride-controller`, `pov-controls`. The first-person rendering, vehicle placement and signage, cinematic rides, mouse-look + raycast picking. Reads game state through `game-state-store`/`runner-store` selectors; never makes game decisions itself.
4. **HUD / React** — `hud-shell`, `move-board-overlay`, `victory-overlay`, `debug-overlay`, `setup-flow`. Setup flow runs before the game. The hud-shell mounts drawers, banners, ticket selector, confirm button, magnify toggle, and notifications. The move-board-overlay is the diegetic paper-map TAB view. The victory and debug overlays are full-screen mounted on game-end or `Ctrl+D`.

The backend stays fully unchanged. Today's broadcasts include Mr. X's actual position in every message (detectives could read it from the network panel), but in practice players don't inspect network traffic during a browser game — so the deduction engine doesn't need to be an *information gate*. It's a **planning aid**: it powers the heatmap, hover-preview ("how would this move narrow my suspect set?"), replay visualization, and the AI's strategic scoring. Players see the deduction surface in the UI but, in theory, can technically peek under the hood; we accept that trade-off in exchange for zero backend churn.

Visually, the player stays in first-person 99% of the time. The crosshair tells them what they're about to do. In-world labels above each visible vehicle tell them where it goes and what it costs. The HUD shows ticket counts and round/reveal state. TAB opens the diegetic A-Z paper map — a hand-drawn-feeling overlay (camera "tilts down to look at the map in your hands" feel) — with the full London graph, current position, available destinations marked, detective tokens, and the deduction heatmap for the detective. Press TAB again to dismiss and you're back in first-person at the same spot.

All the legacy frontend's features come along: themes (classic London + Harry Potter, with character art, transport-label remapping, theme-tinted reveal flash and victory confetti), AI players (detectives only at launch), magnify (now applies to the paper map only, not the FPV — pinches the diegetic), full move history per Mr. X round with reveal markers and secret/double/river indicators, victory screen with replay, replay controls (turn-by-turn scrubber post-game), debug panel (`Ctrl+D`, dev mode only), i18n via react-i18next, IP-geo "Hey USERNAME · CITY" greeting on setup, screen shake + reveal spotlight on reveal rounds. Nothing the player has today gets dropped.

## User Stories

A long, deliberately exhaustive list. Organized by phase, not priority. Numbered so they can be referenced in implementation.

### Setup, lobby, themes

1. As a player visiting the site, I want a cinematic animated background on the start screen, so that the game feels alive before I've even joined.
2. As a player, I want to see a greeting like "Hey Alice · from London", so that the app feels personalized from first contact.
3. As a player, I want to pick a theme (classic London 1983 or Harry Potter / Wizarding World) before creating a game, so that the entire visual + character + transport labelling adapts to the world I want to play in.
4. As a player, I want to enter or update my username on a dedicated screen, so that other players see who I am.
5. As a player, I want my username to persist across sessions in `localStorage`, so that I don't re-enter it every time.
6. As a player, I want to choose between "Play with AI" and "Play with humans" on the setup flow, so that I can decide the lobby composition before role selection.
7. As a player, I want to pick a role from a fan-arranged carousel of character cards (one per role: Mr. X, Detective 1–5), so that the choice feels visual and tactile.
8. As a player, I want roles already taken by other connected players to be visibly unavailable, so that I don't pick a duplicate.
9. As a player, I want to see a "Continue Game" option on the start screen if I have a game in progress in `localStorage`, so that I can resume without remembering the channel code.
10. As a player, I want to click "Copy and Play" to copy a shareable channel link, so that I can invite friends.
11. As a player, I want to read the rules from any setup screen via a Rules drawer, so that I can refresh on mechanics without leaving setup.
12. As a player, I want the game URL to look like `/game/{channel}?role=detective2&theme=hp`, so that bookmarking and sharing both work.
13. As a player creating a game with AI detectives, I want the empty seats auto-filled by AI before the game begins, so that I can start immediately without waiting for humans.
14. As a player, I want a clear "AI" badge on character cards for AI-controlled players in setup and in-game, so that I always know who's a bot.
15. As a player, I want to know that AI Culprit is currently disabled, so that I don't expect to play against an AI Mr. X yet.
16. As a player, I want a language picker on the start screen, so that I can play in English, French, Japanese, Polish, or Ukrainian.

### Loading into the game

17. As a player joining a game, I want the 3D world to begin rendering immediately while the WebSocket connects, so that I see the city instead of a loading spinner.
18. As a player, I want a one-time intro card with control hints ("Click to look around · Click to ride · TAB to open map · ESC to free cursor"), so that I know how to play.
19. As a player, I want the intro to dismiss with a single click that *also* locks the pointer, so that I'm playing immediately, not clicking twice.
20. As a player whose connection drops, I want the client to auto-reconnect after a brief wait, so that I don't lose my session.
21. As a player who reconnects, I want my role and last game state restored from the URL + server, so that I rejoin the same seat.

### Taking a turn — universal

22. As the active player, I want a clearly visible turn banner ("Your turn") to slide in for ~1.6s when my turn begins, so that I don't miss that it's my move.
23. As any player, I want the turn banner to only animate for the local viewer when it's that viewer's turn, so that I'm not distracted by other players' banners.
24. As the active player, I want the world to feel a touch more alive on my turn — slight bloom on the HUD, my crosshair brighter — so that there's a physical signal it's my move.
25. As a non-active player, I want the board to remain explorable (mouse look still works), so that I can think about my plan during the other player's turn.
26. As any player, I want the HUD at the top to show ROUND number + my current location (named landmark if available, else "Junction #N"), so that I always know my position.
27. As any player, I want a ticket bar at the bottom of the screen showing each of my ticket counts (taxi / bus / underground / + secret / + double / + river for Mr. X), so that I see resources at a glance.
28. As any player whose ticket count for a transport is 1 or 2 (low), I want that counter to pulse and glow orange, so that I feel the resource constraint.
29. As any player whose ticket count for a transport is 0, I want that counter visibly dimmed in red, so that I don't try to use what I don't have.
30. As any player, I want a hint in the corner — "TAB open map" — when I'm in FPV with the pointer locked, so that I always remember how to access the map.

### Taking a turn — looking at vehicles in first person

31. As the active player, I want to mouse-look 360° around the intersection in first-person, clamped to a sensible pitch range, so that I can survey all options.
32. As the active player, I want to see *every* available transport from this node as a physical vehicle in the scene — taxi at one curb, bus at another, underground entrance + stairs down, river ferry at the dock if this is a river node — so that I see the same affordances the board has.
33. As the active player on a node with multiple taxis (or multiple buses, etc.), I want all of them visible as distinct parked vehicles around the intersection, so that I can pick which destination to board, not just the first one.
34. As the active player, I want each visible vehicle to carry an in-world destination signage label (3D billboard or screen-space tooltip near the vehicle): destination landmark name + node number + ticket cost preview, so that I can compare options without leaving FPV.
35. As the active player looking at a vehicle, I want the destination label to also show "Detective Alice is at this node" when applicable, so that I see whether boarding would land me on a teammate (illegal for detectives) or capture Mr. X.
36. As the active player, I want my crosshair to recolor + bloom when it overlaps a vehicle, with the color coded to that transport (yellow taxi / red bus / blue underground), so that "what am I aiming at" is immediate.
37. As the active player whose crosshair is on a vehicle, I want a confirmation hint below the crosshair: "Take this taxi · to Marylebone · uses 1 taxi ticket · 10 left after", so that I can confirm the decision before clicking.
38. As the active player, I want a single click on a vehicle to commit to boarding it, so that there is no ambiguity between "look at" and "take".
39. As the active player, I want my click to be ignored if I don't have a ticket for that transport, with a brief red screen flash + an audio cue, so that I'm told why nothing happened.
40. As the active player, I want my click to be ignored if my move would land on another detective (only applies when I'm a detective), with the same red-flash feedback, so that the collision rule reads as a hard rule, not a soft one.

### Taking a turn — detective-specific

41. As a detective, I want to take a taxi/bus/underground move and watch a cinematic ride animate me to the next intersection, so that the act of moving feels like a real action, not a state change.
42. As a detective, I want to see the heatmap of where Mr. X might be on the paper map (TAB view), so that I can plan informed pursuits.
43. As a detective, I want to see other detectives' positions on the paper map as colored tokens labeled with the detective name, so that I can coordinate without verbal communication.
44. As a detective, I want to see when Mr. X was last revealed and on which node, marked on the paper map, so that I orient my pursuit.
45. As a detective, I want to see when the next reveal round is happening (a countdown badge on the HUD, e.g. "Mr. X reveal in 2 rounds"), so that I time my pressure.
46. As a detective, I want my available destinations from this node to be highlighted on the paper map with transport-colored rings, so that I can see at a glance which connections exist from where I stand.
47. As a detective, I want to *hover* a candidate destination on the paper map and see how the deduction heatmap would change if I made that move, so that I can plan multi-turn pincer maneuvers.
48. As a detective, I want a toggle on the paper map for hiding/showing the deduction heatmap, so that I can declutter the view when I want to focus on connections.
49. As a detective, I want to land on Mr. X's node and immediately see the game end with a capture cinematic, so that the moment of the catch is rewarding.
50. As a detective with no valid moves (no ticket of any transport that has an available destination), I want my turn to be visibly skipped with an explanation toast, so that the game doesn't stall silently. *(decision later: also auto-end?)*

### Taking a turn — Mr. X-specific

51. As Mr. X, I want my position to be invisible to detectives between reveal rounds, so that the hidden-movement tension is real.
52. As Mr. X, I want to see my own actual position on the HUD and on the paper map at all times, so that I can plan.
53. As Mr. X, I want my available moves to include river connections, marked visibly with a ferry/boat at the dock when the current node has river edges, so that river routes feel like a special escape, not an abstraction.
54. As Mr. X, I want my river moves to cost zero tickets (current behavior), so that the river remains the strategic depth-charge it is on the board.
55. As Mr. X, I want a "Secret" toggle next to the ticket bar that I can engage before clicking a vehicle, so that I can hide which transport I actually used.
56. As Mr. X, when I engage Secret and then board a vehicle, I want one secret ticket and one transport ticket to deduct, so that the cost feels right (one of each).
57. As Mr. X, I want the move log entry for a Secret move to render as "Secret" in purple (no transport icon revealed), so that the detectives can't read the transport off the log.
58. As Mr. X, I want a "Double" toggle next to the ticket bar — usable only if I have a double ticket — so that I can declare a double-move turn.
59. As Mr. X, with Double engaged, I want to make my first move, watch the cinematic ride, and *remain* the active player to immediately make a second move, so that the double feels like a real "do two things" instead of two turns.
60. As Mr. X, with Double engaged, I want my double ticket count to decrement once, and both transport tickets to deduct as normal, so that the cost matches the rules.
61. As Mr. X, with Double + Secret combined, I want both moves to be hidden from the move log (first move always hidden; second move hidden too if I keep Secret engaged), so that the deception compounds.
62. As Mr. X, I want my Double, Secret, and River availability to be hidden from detectives' UI (they see Mr. X's ticket counts but only my taxi/bus/underground; secret and double counts are visible to *me* and Mr. X only). *(decision: validate this rule with current product expectations.)*
63. As Mr. X, when I have no valid move (all tickets exhausted with no reachable destination, no river), I want the game to end as a detective win, with a clear "Mr. X is cornered" overlay, so that the game doesn't hang.
64. As Mr. X, I want the reveal rounds — after moves 3, 8, 13, 18, 24 — to be visible on the HUD as upcoming events, so that I can plan when to use my Secret tickets to maximum effect.
65. As Mr. X, I want a screen-shake + reveal spotlight effect when I'm revealed (visible to all players including me), so that the moment is dramatic.

### Map awareness — the paper A-Z map

66. As any player, I want to press TAB to open a full-screen diegetic A-Z paper map, with the FPV camera tilting down as if I'm looking at a map in my hands, so that planning has a moment of mode-switch instead of cluttering the FPV.
67. As any player, I want the paper map to show all 200 London nodes, hand-drawn-feeling, with named landmarks in italic serif type ("Baker Street", "King's Cross", "Trafalgar Square") and unnamed nodes in tiny monospace digits, so that the map reads as a real London A-Z.
68. As any player, I want the paper map to show all connections as colored ink lines: yellow taxi, red bus, dashed thick blue underground, dashed thin blue river — with the Thames band sketched across the bottom — so that the transport network is legible at a glance.
69. As any player, I want my current location marked with a large red ink ring + "YOU" label, so that I can find myself instantly.
70. As any player, I want available destinations from my current node marked with transport-colored dashed rings + transport label + destination name, with dashed lines connecting them to my current node, so that I can plan a move from the map view.
71. As any player, I want to click a destination on the paper map (in addition to clicking the vehicle in FPV), so that I can plan and execute from the map alone if I prefer.
72. As a detective, I want the paper map to color-tint nodes in the current possible-Mr.X set, with intensity scaled to per-node weight, so that the heatmap surfaces my best deduction.
73. As a detective, I want the paper map to mark every other detective's current position with a token colored by role, so that I can read team positioning at a glance.
74. As a detective, I want the last revealed Mr. X position marked with a hand-drawn "X" + round number, so that I remember the last sighting.
75. As any player, I want to press TAB again, or ESC, or click the dark backdrop, to close the paper map and return to FPV at the same intersection orientation, so that closing the map doesn't disorient me.
76. As any player, I want a legend at the bottom of the paper map (Taxi · Bus · Underground · You · Mr. X last seen), so that the symbols are self-explanatory.

### Magnify

77. As any player, I want a magnify-lens toggle (button in the HUD chrome) that, when active, magnifies a circular area of the paper map under my cursor by ~2×, so that I can read densely packed central London without zooming the whole view.
78. As any player, I want the magnify lens to follow my cursor in real-time, so that exploring the map is fluid.

### Move log + history

79. As any player, I want a collapsible right-side drawer that shows Mr. X's move history across 24 rounds chronologically, so that I can scrub through the public-information log.
80. As any player, I want each move log entry to render the transport type with the correct icon and color: taxi yellow, bus green/red, underground red/dashed, secret purple, double indicator, river blue, so that the symbolic language matches the board game.
81. As a detective, I want unrevealed Mr. X moves to display position as "??" (the position field stripped from the broadcast), so that hidden movement stays hidden.
82. As a detective, I want revealed moves (after rounds 3, 8, 13, 18, 24) to show the actual position number, with a small "eye" icon and a soft glow, so that reveal markers are unmissable.
83. As any player, I want the most recent move in the log to have a pulsing glow effect, so that I can pick up where the action is.
84. As any player, I want a collapsible left-side drawer showing all players (Mr. X + 5 detectives), each with their character image, username, current position (only revealed when applicable), and ticket counts, so that I can audit the table state.
85. As a detective, I want to click another detective's card to "impersonate" their view (perspective switch — see the world as them, including their available moves), so that I can plan from a teammate's angle. *(decision later: authentication / seat lock.)*
86. As any player, I want each player's card to highlight green when it's their turn, so that turn ownership reads instantly.

### Multiplayer awareness + WebSocket

87. As any player, I want to see a transient toast notification when a player joins my game ("Bob joined as Detective 3"), so that I know who's at the table.
88. As any player, I want to see a transient toast when a player makes a move ("Detective 2 moved to Bond Street via bus"), so that I track other moves even if my drawer is closed.
89. As any player, I want to see a toast + visible "disconnected" badge on a player's card when they drop, so that I know who's missing.
90. As any player, I want the game to *not* advance past a disconnected player's turn automatically (current behavior), so that I don't get a chaotic empty-turn. *(decision later: AI takeover-on-disconnect option.)*
91. As any player, I want the server to be the sole source of truth for valid moves: the client's validator is a UX preview that mirrors server validation, so that desync bugs can't grant illegal moves.

### Reveal rounds + drama

92. As any player, I want a dramatic screen shake + a 2s reveal spotlight effect on Mr. X's node whenever Mr. X is revealed (rounds 3, 8, 13, 18, 24), so that reveal moments are unmissable.
93. As any player, the reveal effect's color should match the active theme (orange for classic, gold for Harry Potter), so that the moment feels theme-coherent.
94. As any player in FPV at the moment of reveal, I want the camera to optionally pan + zoom to Mr. X's revealed node (or at least show his rough location indicator on the compass / map hint) — *(decision later: cinematic vs purely on-paper-map reveal)* — so that the cinematic moment lands.
95. As any player, I want the move log entry for the revealed move to show position + transport (unless transport was Secret, in which case position only), with a clear "REVEALED" marker, so that the public-information state is accurate after the reveal.

### End-game

96. As any player, I want the game to end immediately when a detective lands on Mr. X (capture) or when Mr. X completes all 24 moves without capture (escape), with a victory overlay that announces the winning side, so that the conclusion is unambiguous.
97. As any player, I want a themed confetti animation on the victory overlay (palette tinted by theme), so that the moment feels celebratory.
98. As any player, I want a "Play Again" button on the victory overlay that creates a fresh game and routes to its channel, so that I can rematch in one click.
99. As any player, I want a "View Replay" button on the victory overlay, so that I can re-watch the just-finished game with full information.
100. As any player, the victory overlay should announce the winner by name + role + character image, so that the announcement feels personal, not generic.

### Replay mode

101. As any player after a game ends, I want to enter a replay mode where I can step through every round of moves, see Mr. X's actual position at every step, and see the deduction heatmap evolution turn-by-turn, so that I can review my strategy.
102. As a player in replay, I want a horizontal scrubber + Prev/Next buttons to navigate, so that I can move freely between turns.
103. As a player in replay, I want the FPV scene to follow the replay turn (rebuild at the replayed node) so that I can re-experience each turn in first person, not just on the paper map.
104. As a player in replay, I want a clear visual indicator ("REPLAY") on the HUD, so that I never confuse replay with live state.
105. As a player in replay, I want live game updates (if any are still coming in) to not overwrite my replay view, so that scrubbing isn't interrupted by stragglers.

### Theming

106. As any player switching theme on the start screen, I want every appropriate piece of the UI to re-skin: character images, transport label strings, color palette, victory confetti colors, reveal-spotlight color, audio overrides, cinematic backdrop, so that the theme is a real costume on the same game.
107. As a Harry Potter player, I want "taxi → Knight Bus", "bus → Hogwarts Express", "underground → Floo Network" relabels (per the existing theme), so that the lore lands.
108. As a Harry Potter player, I want detective character cards to use the HP cast (Hermione, Ron, etc.) per the existing theme mapping, so that the world is consistent.
109. As any player, I do *not* want theme switching mid-game, so that no character-image inconsistency leaks in. *(Theme is locked at game create.)*
110. As any player, theme-aware translations should pass through `t()` keys, so that translation + theming compose cleanly.

### Debug / dev

111. As a developer, I want `Ctrl+D` to toggle a debug overlay showing: my WebSocket connection state, the *actual* Mr. X position (spoiler), the deduction engine's current possible-positions set + top weights, the raw move log, the server-broadcast game state, so that I can validate game correctness without playing a full game.
112. As a developer, I want the debug overlay stripped from production bundles via env flag, so that no player sees the spoiler in prod.
113. As a developer, I want the heatmap toggle to flip on/off (independent of the paper map being open), so that I can verify the deduction visually.
114. As a developer, I want an FPS / draw-call counter inside the debug overlay, so that I can spot performance regressions.

### Audio

115. As any player, I want a "ticket spent" SFX whenever any player's ticket count decrements, so that resource use has a felt cost.
116. As any player, I want a "low ticket warning" SFX the first time any of my counters reaches 2, so that scarcity is audible.
117. As any player, I want a distinctive "capture" SFX when a detective lands on Mr. X, so that the moment is sonically dramatic.
118. As any player, I want a "reveal" SFX in sync with the reveal spotlight on rounds 3, 8, 13, 18, 24, so that reveals are felt, not just seen.
119. As any player, I want ride-specific ambient sound during a cinematic ride (taxi engine for taxi, bus engine for bus, tube rumble for underground, water/boat for river), so that the ride is immersive.
120. As any player, I want a mute toggle on the HUD, with state persisted, so that I can play silently if needed.
121. As any player, audio cues should respect the active theme where overrides exist (e.g. HP capture SFX vs classic capture SFX), so that audio is part of theming.

### Edge cases

122. As any player, if I disconnect and reconnect, my session state should resync from the server (or from `localStorage` for setup state), so that I'm dropped back where I was.
123. As any player, if my browser tab is backgrounded, the render loop should throttle and rides should pause/resume gracefully, so that I don't burn CPU off-screen.
124. As any player on a node with zero outgoing edges of any type I can afford, my turn is skipped with a "no valid move" toast, so that the game progresses. *(For Mr. X this also ends the game as a detective win.)*
125. As any player, the magnify lens and the paper map cannot both be in focused-overlap states; magnify only applies to the paper map view, so that the magnify is unambiguous.
126. As any player, invalid input (clicking a vehicle I can't afford, clicking a destination occupied by a teammate, clicking during another player's turn) triggers a red screen flash and a brief audio cue, so that invalid actions never silently no-op.
127. As any player, the camera in FPV does not move during another player's turn (no auto-focus stealing my framing), so that I keep my chosen viewpoint while the opposing side moves.
128. As any player, when an AI player takes its turn, I see a "AI thinking…" indicator on the HUD with a short timeout (≥1.5s) before the AI's move resolves, so that the AI feels deliberate, not instant.

## Implementation Decisions

### Architecture

- **Layered pipeline**: WebSocket message → `websocket-client` → `game-state-store` (canonical state) → `runner-store` (local-only view state) → pure-logic modules compute derived state → 3D world + HUD subscribe via selectors. Nothing past the store mutates game state.
- **Pure-logic core is testable without React or Three.js**: `move-validator`, `deduction-engine`, `theme-registry`, `replay-controller`, and `map-data`. Each has a small public surface; each internalizes a lot of rules.
- **Backend left fully unchanged.** Today's broadcasts include Mr. X's actual position to all clients; the deduction engine is a *planning aid* on top of public information (move log + reveal rounds + ticket history), not an information gate that hides Mr. X from determined network-snoopers. We accept this trade-off — players don't inspect network responses — in exchange for zero backend churn.
- **WebSocket protocol unchanged**: `joinGame`, `makeMove`, `updateGameState`, `endGame`, `impersonate` continue to use the existing message shapes from `apps/frontend`. `frontend-pixi` re-implements the *client* side fresh; the server treats it as just another client.
- **Server is the sole authority for valid moves**: the client validator runs to power UX (gray out unaffordable transports, preview heatmap deltas), but the server is the truth.
- **Stack**: React 18 + Three.js (v0.184) + Zustand 5 + GSAP + react-i18next (existing locales: en, fr, ja, pl, ua) + Chakra UI for HUD chrome (existing dep). No new state library, no new router (single-route app inside `frontend-pixi`).
- **`shared-utils` reuse is allowed**: `mapData`, `showCulpritAtMoves`, `RoleType`, `Move`, `Player`, `GameState`, `deduction-engine`. Everything else in `frontend-pixi` is fresh code (already a clean-room rebuild — see existing memory note `project_pixi_frontend`).
- **The 24 modules** (see Solution section above): 5 pure-logic, 9 state/IO adapters, 5 Three.js, 5 HUD/React.

### Locked design decisions

1. **Detective-detective collision is enforced in `move-validator` (client-side).** The validator grays the destination on the paper map, refuses the click in FPV, and shows a red flash + audio cue if attempted. The server is *not* changed (no backend churn — see architecture note above); the same trust-the-client trade-off applies as for the deduction engine. Today humans can ignore the rule because only the AI's heuristic enforces it; the client validator closes that gap for normal play.

### Decisions left open (the PRD does not lock these; implementation pass will)

- **Multi-vehicle intersections**: when a node has multiple taxi or multiple bus connections, do we render N parked vehicles (each clickable), or one vehicle with an arrow-picker to alternates? Affects `vehicle-spawner.placeAtIntersection` and the in-world signage. Default proposal: render up to N vehicles at distinct curbside slots if visual budget allows; otherwise one with picker.
- **River-ticket cost**: keep free for Mr. X (current behavior), or charge a ticket? Default proposal: keep free, matches the board game's reading and the existing code.
- **Mr. X-stuck end-game**: auto-detective-win, or soft "Mr. X is stuck" warning with no game end? Default proposal: auto-detective-win — game shouldn't hang.
- **Heatmap render location**: paper map only, in-world ground glow only, or both? Default proposal: paper map only at launch — keep FPV immersive.
- **Impersonate semantics**: free perspective-switch (today) or seat-claim-with-lock? Default proposal: free perspective switch with a UI warning "you are viewing as Detective N"; do not change ownership.
- **AI Culprit**: deferred to v2 (existing code disables it; the broken-AI-pursuit history makes it risky).
- **Replay support**: client-side replay from local move log at v1 (no server-side history endpoint).
- **Audio in v1**: include the SFX set described in user stories #115–121; mute toggle persisted in `local-prefs` (or `runner-store`).
- **Theme set at launch**: classic + Harry Potter (the two themes that already exist). No new themes in this PRD.
- **Number of detectives**: hardcoded at 5 (matches current code).
- **Turn timer / idle timeout**: not in this PRD.
- **Magnify scope**: paper-map only (not the FPV view). The legacy FPV magnify was a board-only feature; in 3D the magnify metaphor maps naturally to the paper map.
- **In-world vehicle labels** style: 3D billboards (sprites that face camera) or screen-space tooltips at projected vehicle position. Default proposal: screen-space tooltip with crosshair tracking; cheaper and works at any distance.
- **Persistent local prefs storage**: small `local-prefs` module backed by `localStorage`, or folded into `runner-store` with a `localStorage` middleware. Default proposal: middleware on `runner-store`.

### Backend changes

None. The backend is left fully untouched. See the trust-the-client trade-off discussed above.

### Schema (no DB changes)

The existing tables (`games`, `players`, `moves`, `ip_info`) remain unchanged. Persistence, channel naming, and the move log all stay as today.

### API contracts (no changes)

- REST: `POST /api/games`, `GET /api/games/:id`, `GET /api/geo` — all unchanged.
- WebSocket: `joinGame`, `makeMove`, `updateGameState`, `endGame`, `impersonate` — all unchanged.

## Testing Decisions

**Decision: no unit tests are written in this PRD.** Per the agreement during PRD-drafting, the v1 implementation does not block on test coverage — the user wants to ship the feature parity first and iterate. Validation is done by manual play across the user stories and integration regressions are caught in the prototype-to-production promotion.

This is a deliberate trade-off, not an oversight. The pure-logic modules (`move-validator`, `deduction-engine`, `theme-registry`, `replay-controller`, `map-data`) are *built to be tested later* — they are pure functions / pure state machines with small interfaces. When a test bar becomes worth raising, those five modules are where the first tests land:

- A "good test" tests **external behavior**, not implementation details. E.g., `move-validator` test fixture should be `(state, move) → expected verdict`, not "the validator called helper X internally."
- Prior art (where tests already exist in this repo): `apps/frontend` has Jest + React Testing Library config (`jest.config.ts`), and `apps/backend` uses Jest for helpers + routes. The same `@nx/jest` setup wires `frontend-pixi`. Examples to follow: existing backend helper tests for move processing.
- The 9 state/IO adapter modules and 5 HUD/React modules are *not* the priority — they're glue, and integration play-throughs cover them well enough.
- The 5 Three.js modules are explicitly out of scope for unit tests — visual / GPU code is best caught by manual play and screenshot comparisons.

When the test bar rises in a later PRD, the recommended ordering is: `move-validator` (rules, every ticket type, edge case) → `deduction-engine` (replay from known-position-set fixtures) → `theme-registry` (data shape integrity) → `replay-controller` (state-machine transitions) → optionally `game-state-store` (reducer purity).

## Out of Scope

- **Backend changes of any kind**: backend is fully untouched. AI logic, persistence, REST endpoints, game-creation flow, channel allocation, broadcast shape — all unchanged.
- **AI Culprit**: deferred to v2. The legacy "AI plays Culprit" option remains disabled.
- **AI detective pursuit fix**: the known broken behavior (detectives flee instead of pursuing) is *not* fixed in this PRD. Tracked as a separate backend issue (see existing memory `project_deduction_engine`).
- **New themes**: only classic London 1983 + Harry Potter ship at launch.
- **New languages**: existing locales (en, fr, ja, pl, ua) carry over; no new translations.
- **Mobile / touch input**: `pov-controls` is desktop-only. No gesture controls for the 3D camera or for taps-on-vehicles.
- **AI-takeover-on-disconnect**: today's behavior (game stalls on disconnected player's turn) is preserved. No auto-AI-takeover.
- **Server-side replay endpoint**: client-side replay only, from in-memory move log. No `GET /api/games/:id/history` endpoint added.
- **Server-side ticket-exhaustion auto-win**: only Mr. X-stuck triggers auto-end. Detective-exhausted (detective with no affordable move) skips the turn but does not auto-lose.
- **Mid-game theme switching**: theme is locked at game creation.
- **Map editor / custom maps**: the 200-node London graph is the only map.
- **Number-of-detectives picker in lobby**: hardcoded at 5.
- **Turn timer / idle timeout**: no auto-skip after N seconds of inactivity.
- **Tactical-map planning tools beyond hover-preview**: no route planner, no "shortest path to X" overlay.
- **Magnify on FPV**: magnify metaphor only applies to the paper map; no lens on the 3D view.
- **In-world (3D) deduction heatmap**: heatmap stays on the paper map.
- **Sound design beyond the SFX set listed in user stories #115–121**: no music tracks, no ambient London soundscape, no NPC chatter.

## Further Notes

### Phasing suggestion (not committed)

Useful sequencing if you want to incrementally land this:

1. **Pure-logic core**: `map-data`, `move-validator`, `deduction-engine`, `theme-registry`, `replay-controller`. No UI changes yet — just modules that the FPV will read from.
2. **State + I/O adapters**: `game-state-store`, `runner-store`, `websocket-client`, `rest-client`, `notification-service`. Now the FPV is talking to the real backend.
3. **Multi-vehicle intersection + signage**: `vehicle-spawner` upgrades; in-world labels.
4. **Paper map upgrade**: integrate deduction heatmap, detective tokens, last-reveal marker, hover preview.
5. **Setup flow + themes**: `setup-flow`, `theme-registry`, `i18n-service`, `geo-greeting-service`, `url-params-router` come online — the FPV is now reachable through the full lobby experience.
6. **HUD shell**: `hud-shell` mounts drawers, turn banner, magnify, ticket selector, victory overlay.
7. **Secret / Double / River**: special-move UX (toggles, FPV ferry vehicle, secret-move-in-log).
8. **Replay**: `replay-controller` + Prev/Next/scrub UI.
9. **Audio + debug**: `audio-bus`, `debug-overlay`, polish.

Each step ships in isolation; the FPV remains playable (in degraded form) between steps.

### Known broken things to be aware of

- **Backend AI detective pursuit**: detectives currently flee rather than pursue. See `project_deduction_engine` memory. Out of scope but will be visible during multi-AI play.
- **Backend leaks Mr. X position in every broadcast**: known and explicitly accepted (see Solution + Architecture). The deduction engine is a planning aid, not an information gate — players in practice don't sniff the network panel. Backend stays untouched.
- **Detective collision is client-only enforced**: same trust-the-client trade-off. A determined player could bypass the validator; in practice they won't.
- **Impersonate has no auth**: a client can claim any role today. Open decision; default is to keep open semantics with a UI warning.
- **No idle/disconnect timeout**: games will hang on a disconnected player's turn. Out of scope.

### Open decisions (collected, for implementation review)

These were intentionally left unlocked in this PRD because each is small enough to decide during implementation without re-PRDing. Listed here as a punch-list:

- D1. Multi-vehicle intersections: N parked vehicles vs one + picker.
- D2. River-ticket cost: keep free vs charge a ticket (default keep free).
- D3. Mr.X-stuck end-game: auto-detective-win vs warning (default auto-win).
- D4. Heatmap render location: paper map only vs paper + in-world (default paper only).
- D5. Impersonate authentication: open vs seat-lock (default open + warning).
- D6. In-world label style: 3D billboard sprite vs screen-space tooltip (default screen-space).
- D7. Local-prefs storage: separate module vs `runner-store` middleware (default middleware).
- D8. Cinematic Mr.X reveal: camera-fly to revealed node in FPV, or paper-map-only marker (default paper-map only + screen shake in FPV).
- D9. Detective ticket-exhaustion: silent skip vs explicit toast (default explicit toast).
- D10. Audio override mechanism: theme-registry returns sound URLs vs `audio-bus` has per-theme branches (default theme-registry returns URLs).

### Coverage gaps (post-refinement, all minor)

The synthesis identified three remaining gaps after the 24-module refinement; each is intentionally minor and deferred:

- **Persistent settings storage** (mute, language, debug-flag, last-username): folded into `runner-store` with a `localStorage` middleware (per D7), not its own module.
- **Mobile / touch input**: explicitly out of scope (desktop-first launch).
- **AI-takeover-on-disconnect**: out of scope; backend doesn't model it.

### Memory cross-references

- `project_pixi_frontend` — establishes `frontend-pixi` as clean-room with only `shared-utils` + WebSocket protocol reused.
- `project_deduction_engine` — context on the AI pursuit bug and the Culprit-position-leak. The leak is **not** fixed in this PRD (see new feedback `trust-the-client-tradeoff` for the rationale).
- `feedback_fpv_direction` — locks the first-person POV direction as the validated visual stack; this PRD does not revisit that choice.

### Acceptance bar

This PRD is "done" when, playing as either Mr. X or a detective, I cannot point to a feature the SVG `apps/frontend` has that the new `apps/frontend-pixi` is missing — and I can additionally do everything the FPV makes new (cinematic ride, in-world vehicle signage, diegetic paper map TAB, immersive first-person looking around). When playing, every user story #1–#128 is visibly satisfied.
