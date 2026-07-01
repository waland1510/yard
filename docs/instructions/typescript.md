# TypeScript Standards

## Strict Mode

All packages use `strict: true`. Never use `any` — use `unknown` and narrow, or define the proper type.

## Naming

- Files: `kebab-case.ts`
- React components: `PascalCase.tsx`
- Functions/variables: `camelCase`
- Types/interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

## Async

- Always `await` — never `.then()` chains for sequential logic.
- Never use `Promise.resolve()` as a no-op delay.
- Prefer `async/await` in Zustand actions.

## Imports

- Use path aliases defined in `tsconfig.base.json` (e.g., `@yard/shared-utils`).
- No circular imports between layers. Render imports from core/stores; core/stores do not import from render.

## Non-Negotiable Rules

- No `console.log` in committed code — use structured logging or remove.
- No `// TODO` comments without an issue reference.
- No `@ts-ignore` — fix the type error instead.
- Prefer `const` over `let`; never `var`.
- Destructure function parameters when they come from a known type.

## Types vs Interfaces

- Use `interface` for object shapes that may be extended.
- Use `type` for unions, intersections, and mapped types.
- Export all shared types from `shared-utils`.

## Commands

```bash
bun nx typecheck frontend-pixi   # type check without building
bun nx lint frontend-pixi        # ESLint
```
