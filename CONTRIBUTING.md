# Contributing to Fleet

Fleet is early-stage and contributions are very welcome. Here's what's most needed right now.

## What we need most

**Adapters** — wrappers for Gemini CLI, OpenCode, Cursor CLI, Amp, and others. See [docs/adapters.md](docs/adapters.md). This is the highest-impact contribution.

**Protocol feedback** — read [docs/protocol.md](docs/protocol.md) and open an issue if anything is unclear, broken, or missing. The protocol is v1.0 and we want it stable before v1.0 CLI release.

**Real-world testing** — try `fleet init` and `fleet ship --join` on your actual projects. File issues for anything that breaks or feels wrong.

## Setup

```bash
git clone git@github.com:fleetspark/fleet.git
cd fleet
npm install
npm run build
npm link  # makes `fleet` available in your terminal
```

## Structure

```
packages/
  core/        # Protocol parser, DAG scheduler, heartbeat monitor
  cli/         # CLI commands (fleet init, command, ship, status, etc.)
  adapters/    # Agent adapters — great place to contribute
    claude/
    codex/
    aider/
  merge/       # Merge supervisor: diff, CI gate, rebase, PR creation
docs/
  protocol.md  # FLEET.md + MISSION.md spec — the open standard
  adapters.md  # How to write an adapter
examples/
  solo-single/ # One machine, multiple worktrees
  solo-multi/  # Multiple machines
  overnight/   # Full overnight sprint example
```

## Principles

- **Protocol stability over features.** The FLEET.md and MISSION.md schemas are the most important thing. We don't break them.
- **Agent-agnostic.** Fleet never favours one coding agent over another.
- **Git as the bus.** We don't add network infrastructure. If it requires a server, it doesn't belong in the OSS tool.
- **Commander never writes code.** The commander only coordinates. Ships do the work.

## Opening a PR

- Keep PRs focused — one thing per PR
- Update docs if you change protocol behaviour
- Add an example if you're adding a new adapter
