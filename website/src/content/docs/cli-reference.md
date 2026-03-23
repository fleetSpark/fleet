---
title: CLI Reference
description: Complete reference for all fleet CLI commands.
---

## fleet init

Initialize Fleet in the current repository.

```bash
fleet init
```

Creates `.fleet/config.yml` and the `fleet/state` orphan branch with an empty `FLEET.md`.

---

## fleet command

Start or resume the commander.

```bash
# Plan missions from a natural language goal
fleet command --plan "Add OAuth login, fix rate limiter, update docs"

# Load missions from a YAML plan file
fleet command --plan-file missions.yml

# Resume an existing fleet (re-claim commander)
fleet command --resume

# Resume with graceful handoff support
fleet command --resume --handoff
```

| Flag | Description |
|------|-------------|
| `--plan <goal>` | Natural language goal for LLM decomposition |
| `--plan-file <path>` | YAML file with pre-defined missions |
| `--resume` | Resume monitoring existing missions |
| `--handoff` | Enable implicit commander handoff (any machine can resume) |

---

## fleet ship

Join the fleet as a worker ship.

```bash
fleet ship --join git@github.com:you/project.git
```

Clones the repo, reads `FLEET.md`, auto-assigns to the first ready mission, starts the coding agent, and begins heartbeat pushes.

| Flag | Description |
|------|-------------|
| `--join <repo>` | Git URL of the repository to work on |

---

## fleet status

Display the mission board.

```bash
# One-shot display
fleet status

# Live-updating display
fleet status --watch

# Machine-readable JSON output
fleet status --json
```

| Flag | Description |
|------|-------------|
| `--watch` | Refresh the display every 30 seconds |
| `--json` | Output fleet state as JSON |

---

## fleet assign

Manually assign a mission to a ship.

```bash
fleet assign <mission-id> <ship-id>
```

---

## fleet brief

Generate a codebase context file for ships.

```bash
# Static analysis (file tree, package.json, etc.)
fleet brief --generate

# LLM-powered analysis (richer context)
fleet brief --generate --llm
```

Creates `FLEET_CONTEXT.md` on the main branch. Ships read this file for codebase context before starting work.

| Flag | Description |
|------|-------------|
| `--generate` | Generate the brief |
| `--llm` | Use LLM for richer codebase analysis |

---

## fleet logs

View a ship's MISSION.md log.

```bash
# One-shot display
fleet logs <ship-id>

# Follow mode (polls every 10s)
fleet logs <ship-id> --follow
```

| Flag | Description |
|------|-------------|
| `--follow` | Keep polling for updates |

---

## fleet dashboard

Interactive terminal UI for monitoring the fleet in real-time.

```bash
fleet dashboard
# or
fleet dash
```

Features:
- **Mission board** — color-coded status table with progress tracking
- **Ship health** — live heartbeat monitoring with alive/stale/dead indicators
- **Merge queue** — PR and CI status at a glance
- **Log viewer** — drill into any mission's steps and blockers

| Key | Action |
|-----|--------|
| `j`/`k` or arrows | Navigate missions |
| `Tab` | Switch between board and log views |
| `q` | Quit |

The dashboard auto-refreshes every 10 seconds.
