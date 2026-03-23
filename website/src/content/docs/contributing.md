---
title: Contributing
description: How to contribute to Fleet — adapters, bug fixes, and more.
---

Fleet is open source and contributions are welcome. See the full [Contributing Guide](https://github.com/fleetSpark/fleet/blob/main/CONTRIBUTING.md) on GitHub.

## What we need most

1. **Adapters** — wrappers for new coding agents (Gemini CLI, Cursor CLI, Amp, etc.). This is the easiest and highest-impact contribution. See [Adapters](/adapters/).
2. **Real-world testing** — try Fleet on your actual projects and [file issues](https://github.com/fleetSpark/fleet/issues) for anything that breaks.
3. **Bug fixes** — check [open issues](https://github.com/fleetSpark/fleet/issues?q=is%3Aissue+is%3Aopen+label%3Abug).
4. **Documentation** — improvements to this site or inline code docs.

## Setup

```bash
git clone git@github.com:fleetspark/fleet.git
cd fleet
npm install
npm run build
npm run test:all   # 218+ tests must pass
```

## Project structure

```
packages/
  core/          # Protocol, state machine, scheduler, git ops, merge,
                 # election, notifications, telemetry, resources
  cli/           # CLI commands + interactive TUI dashboard
  adapters/
    claude/      # Claude Code adapter
    codex/       # Codex CLI adapter
    aider/       # Aider adapter
    opencode/    # OpenCode adapter
    a2a/         # A2A protocol adapter
tests/
  unit/          # Fast unit tests (mock-based)
  integration/   # Tests against real local git repos
  unit/regression/  # Regression tests for fixed bugs
website/         # This documentation site (Astro Starlight)
```

## Design principles

These are non-negotiable:

- **Protocol stability over features.** FLEET.md and MISSION.md formats don't break.
- **Agent-agnostic.** Fleet never favors one coding agent over another.
- **Git as the only bus.** No SSH, no shared filesystem, no servers.
- **Commander never writes code.** The commander only coordinates.
- **State machine as law.** All transitions use `transition()`, never direct assignment.
- **Tests are mandatory.** Every PR must include tests.

## Opening a PR

1. Fork the repo, create a feature branch
2. Make your changes
3. Run `npm run build && npm run test:all` — all 218+ tests must pass
4. Submit a PR — fill out the template

### What happens automatically

- CI runs build + tests on Node 18, 20, 22
- A bot posts a risk assessment and review checklist
- Auto-labeler tags your PR (core, adapter, docs, etc.)
- Protocol changes get flagged for careful review

### Review criteria

- Tests included for new code
- No protocol breaking changes
- Uses `transition()` for status changes
- Proper error handling (no swallowed errors)
- PR is focused (one thing per PR)

## Writing an adapter

The easiest way to contribute — about 30 lines of TypeScript:

1. Create `packages/adapters/<agent-name>/`
2. Implement the `FleetAdapter` interface
3. Add tests in `tests/unit/adapters/`
4. Register in `packages/core/src/adapters/registry.ts`

See [Adapters](/adapters/) for full details and examples.
