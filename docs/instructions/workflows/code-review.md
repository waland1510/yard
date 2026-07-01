# Code Review Workflow

Non-negotiable checklist before merging any PR.

## Architecture

- [ ] Change stays within one layer — no render → store imports
- [ ] No circular imports
- [ ] Shared-utils changes: both frontend and backend impact considered

## TypeScript

- [ ] No `any`, `@ts-ignore`, or `console.log`
- [ ] All async paths use `await`
- [ ] Strict mode satisfied (no implicit `any`, no `null` without check)

## Game Logic

- [ ] Deduction engine changes have unit tests
- [ ] Move validator changes tested with valid + invalid scenarios
- [ ] Store mutations go through `set()` only

## Frontend-Pixi

- [ ] Pixi/Three components do not import Zustand stores
- [ ] Pixi objects cleaned up on unmount (`.destroy()`)
- [ ] Three.js geometries and materials disposed on unmount

## React Health

- [ ] `npx react-doctor@latest --verbose --diff` run — score did not regress

## Security

- [ ] No secrets in code
- [ ] User input validated before use
- [ ] No `dangerouslySetInnerHTML`

## Tests

- [ ] Tests cover happy path, error cases, and edge cases
- [ ] Test names follow `<unit>_<scenario>_<expected>`
