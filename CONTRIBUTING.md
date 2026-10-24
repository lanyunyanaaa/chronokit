# Contributing to ChronoKit

Thanks for your interest! Contributions of all kinds are welcome — bug reports,
documentation, and pull requests.

## Reporting bugs

Open a [bug report](https://github.com/lanyunyanaaa/chronokit/issues/new?template=bug_report.yml)
and include: ChronoKit version, Windows version, steps to reproduce, expected vs
actual behavior. If a write operation went wrong, **Operation History → undo**
is the fastest self-help; attach the journal from `%APPDATA%/chronokit` only if
you are comfortable sharing it (it contains local file paths).

## Development setup

Prerequisites: **Node.js ≥ 20** and **pnpm 9**, on Windows.

```bash
pnpm install
pnpm dev           # run the app in dev mode
pnpm test          # unit tests (vitest, core logic)
pnpm typecheck     # TS checks for main + renderer
```

Please make sure `pnpm test` and `pnpm typecheck` pass before opening a PR —
CI runs both on every push.

## Project conventions

- **Architecture**: keep domain logic in `src/core/` as pure TypeScript with
  unit tests; Electron services live in `src/main/services/`, UI in
  `src/renderer/`. New user-facing behavior should be undoable — that usually
  means it goes through the plan → dry-run → exec → journal pipeline.
- **Commits**: conventional-commit style (`feat:`, `fix:`, `docs:`, `refactor:`),
  one logical change per commit.
- **UI**: the interface uses the in-house design system (see
  [docs/UI-DESIGN.md](docs/UI-DESIGN.md)). No emoji in the UI or docs — use
  inline SVG icons. User-facing strings go in **both** `en.json` and
  `zh-CN.json`.
- **Safety first**: any feature that writes to user files must support dry-run
  preview and undo, and must never rewrite photo container metadata (see the
  roadmap's U2b notes).

## Pull requests

1. Fork / create a branch from `main`.
2. Keep PRs focused; one feature or fix per PR.
3. Describe what changed and why; link related issues.
4. Update `CHANGELOG.md` under an *Unreleased* heading if the change is
   user-visible.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
