# Contributing to Fleet

Fleet is open source and contributions are welcome. This guide explains how to contribute effectively while maintaining project quality.

## Quick start

```bash
git clone git@github.com:fleetspark/fleet.git
cd fleet
npm install
npm run build
npm run test:all   # 218+ tests must pass
```

## What we need most

1. **Adapters** — wrappers for new coding agents (Gemini CLI, Cursor CLI, Amp, etc.). See [Adapters docs](https://fleetspark.dev/adapters/). Highest-impact contribution.
2. **Protocol feedback** — read [protocol.md](protocol.md) and open an issue if anything is unclear, broken, or missing.
3. **Real-world testing** — try Fleet on your actual projects and file issues for anything that breaks.
4. **Bug fixes** — check open issues labeled `bug`.
5. **Documentation** — improvements to website content, examples, or inline docs.

## Project structure

```
packages/
  core/          # Protocol parser, state machine, DAG scheduler, git ops,
                 # heartbeat, merge commander, election, notifications,
                 # telemetry, resource manager
  cli/           # CLI commands + interactive TUI dashboard
  adapters/
    claude/      # Claude Code adapter
    codex/       # Codex adapter
    aider/       # Aider adapter
    opencode/    # OpenCode adapter
    a2a/         # A2A protocol adapter (any A2A-compatible agent)
tests/
  unit/          # Fast unit tests (mock-based)
  integration/   # Tests against real local git repos
website/         # Astro Starlight documentation site
```

## Design principles

These are non-negotiable. PRs that violate them will be rejected.

1. **Protocol stability over features.** The FLEET.md and MISSION.md formats are the project's most important asset. We don't break them.
2. **Agent-agnostic.** Fleet never favors one coding agent over another.
3. **Git as the only bus.** No SSH, no shared filesystem, no websockets. If it requires a server, it doesn't belong in the core tool.
4. **Commander never writes code.** The commander only coordinates. Ships do the work.
5. **State machine as law.** All status transitions go through the validated state machine. No direct status assignments.
6. **Tests are mandatory.** Every new feature or bug fix must include tests.

## Opening a PR

### Before you start

- Check existing issues and PRs to avoid duplicate work
- For large features, open an issue first to discuss the approach
- Fork the repo, create a feature branch from `main`

### PR requirements

Every PR must:

- [ ] Pass `npm run build` (zero TypeScript errors)
- [ ] Pass `npm run test:all` (all 218+ tests green)
- [ ] Include tests for new code (unit tests at minimum, integration tests for git-related features)
- [ ] Have a focused scope (one feature or fix per PR)
- [ ] Fill out the PR template
- [ ] Not break the protocol format (FLEET.md / MISSION.md)

### What happens after you open a PR

1. **CI runs automatically** — build + tests on Node 18, 20, 22
2. **CODEOWNERS review** — the project owner is auto-assigned
3. **Protocol changes get extra scrutiny** — changes to `packages/core/src/protocol/` or `packages/core/src/state/` require detailed justification
4. **Adapter PRs are reviewed faster** — they're self-contained and low-risk

### PR review criteria

Reviewers check for:

- **Correctness** — does it actually work? Are edge cases handled?
- **Tests** — are the tests meaningful (not just import checks)?
- **Protocol safety** — does this change FLEET.md or MISSION.md format?
- **State machine compliance** — does it use `transition()` for status changes?
- **Error handling** — no swallowed errors, no silent failures
- **Type safety** — no unsafe `as` casts without runtime validation

## Writing an adapter

This is the easiest way to contribute. An adapter is ~30 lines of TypeScript.

1. Create `packages/adapters/<agent-name>/`
2. Implement the `FleetAdapter` interface (see [docs](https://fleetspark.dev/adapters/))
3. Add unit tests in `tests/unit/adapters/<agent-name>.test.ts`
4. Register in `packages/core/src/adapters/registry.ts`
5. Add to the build script in root `package.json`

See existing adapters for examples: `packages/adapters/codex/` is the simplest.

## Writing tests

- **Unit tests** go in `tests/unit/<module>/` — use mocks, fast execution
- **Integration tests** go in `tests/integration/` — use real temp git repos
- **Regression tests** go in `tests/unit/regression/` — one test per bug fix
- Tests import from `dist/` not source — run `npm run build` before testing
- Use vitest: `npx vitest run tests/unit/<your-test>.test.ts`

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add new feature
fix(cli): correct bug in status command
test: add regression test for #123
docs: update adapter guide
chore: bump dependencies
```

## Code of conduct

Be respectful, constructive, and patient. We're all here to build something useful.

## Questions?

Open a [Discussion](https://github.com/fleetSpark/fleet/discussions) or file an issue.
