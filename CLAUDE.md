# Project Constraints

- Use `trash` for deletions, never `rm`.
- TypeScript runtime: Bun only. Do not use npm, yarn, or pnpm.
- Python tooling: use `uv` for venv and packages.
- No emojis. No em dashes, use hyphens or colons.
- Research unfamiliar APIs with Exa before implementation, do not guess.
- Look up library APIs with Exa every time, even with a PRD. Do not guess.
- Do not guess numerical values, measure instead.
- Follow OPAR: observe, plan, act, verify, repeat.
- TDD where applicable and run affected tests.
- Always run typecheck and tests after code changes.
- Never use `any` and never swallow errors.
- Logging: one wide event per request, no scattered console.log.
- Never ignore ESLint warnings or errors.
- Fail fast and let errors bubble with context. Only catch errors you handle.
- Simplicity above all: avoid clever abstractions, future flexibility, and enterprise patterns.
- Keep code junior-readable in under 30 seconds and do not over-abstract for DRY.
- If SPEC.md is missing or stale, interview the user and update it before implementation.
- Do not modify frontend code unless explicitly requested.
