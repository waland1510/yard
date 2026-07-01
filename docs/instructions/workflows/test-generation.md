# Test Generation Workflow

## Ordering Rule

**QA runs after Developer.** QA reads Developer's artifact list and uses actual function/type names. Never generate tests speculatively before the implementation exists.

## Failure Mode → Test Type Mapping

| Failure Mode | Test Type | Tool |
|-------------|-----------|------|
| Deduction logic wrong | Unit test | Jest |
| Move validation incorrect | Unit test | Jest |
| Store state corrupt | Unit test | Jest |
| HUD component doesn't render | Component test | React Testing Library |
| User interaction broken | Component test | React Testing Library |
| WebSocket event mishandled | Integration test | Jest + mock WS |
| Full game flow broken | E2E | Playwright (when needed) |

## Coverage Targets

See `docs/instructions/testing.md` for per-area targets.

## Non-Negotiable Coverage Areas

The deduction engine must be tested for:
1. Position elimination after detective moves
2. Reveal round: position confirmed and state updated
3. Double move handling
4. Secret move — transport type hidden but position updated
5. Game start state: all 200 nodes are possible

## Test File Location

Place test files adjacent to the source file:
- `src/core/deduction.ts` → `src/core/deduction.test.ts`
- `src/hud/MapPanel.tsx` → `src/hud/MapPanel.test.tsx`
