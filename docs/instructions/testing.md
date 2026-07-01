# Testing Standards

## Framework

- **Unit tests**: Jest + React Testing Library (all apps)
- **E2E**: Playwright (configured but deprioritized — prefer comprehensive unit tests)

## Test Naming

Pattern: `<unit>_<scenario>_<expected>`

Examples:
- `deductionEngine_afterReveal_narrowsPossiblePositions`
- `gameStore_onDetectiveMoved_updatesPlayerPosition`
- `moveValidator_withExpiredTicket_returnsInvalid`

## What to Test

| Type | Target | Tools |
|------|--------|-------|
| Unit | Deduction engine, move validator, store actions | Jest |
| Component | HUD panels, overlays | React Testing Library |
| Integration | Store + deduction engine together | Jest |

## Deduction Engine Tests (Critical)

The deduction engine must have tests for:
- All reveal rounds (positions where Mr. X is shown)
- Move filtering per transport type
- Impossible position elimination
- Edge cases: double moves, secret moves

## React Testing Library

- Query by role first (`getByRole`), then label, then `data-testid`.
- Never query by class name or CSS selector.
- Use `userEvent` for interactions, not `fireEvent`.
- Wrap async state updates in `act()` or `waitFor()`.

## Coverage Targets

| Area | Target |
|------|--------|
| `shared-utils` | ≥ 90% |
| `core/` (deduction, validator) | ≥ 85% |
| `stores/` | ≥ 75% |
| `hud/` components | ≥ 60% |

## Commands

```bash
bun nx test frontend-pixi            # run all tests
bun nx test frontend-pixi --watch    # watch mode
bun nx test shared-utils             # shared logic tests
```
