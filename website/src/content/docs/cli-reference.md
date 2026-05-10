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

# Use a built-in mission template
fleet command --template test-coverage

# List available templates
fleet command --template list

# Resume an existing fleet (re-claim commander)
fleet command --resume

# Resume with graceful handoff support
fleet command --resume --handoff
```

| Flag | Description |
|------|-------------|
| `--plan <goal>` | Natural language goal for LLM decomposition |
| `--plan-file <path>` | YAML file with pre-defined missions |
| `--template <name>` | Use a built-in mission template; use `list` to see all |
| `--resume` | Resume monitoring existing missions |
| `--handoff` | Enable implicit commander handoff (any machine can resume) |

See [Mission Templates](/templates/) for the full list of built-in templates.

---

## fleet run

Run a mission template locally in sequence — no extra machines needed.

```bash
# Preview the full run experience without spawning real agents
fleet run --template drsti-dev-flow --simulate

# Run a built-in template on the current repo
fleet run --template drsti-dev-flow

# Override the agent adapter for all missions
fleet run --template test-coverage --agent codex

# Run against a specific directory
fleet run --template security-audit --cwd /path/to/project
```

`fleet run` is the single-machine shortcut for `fleet command` + `fleet ship`. It:

1. Loads the named template and topologically sorts its missions by dependency.
2. Checks pre-start gate conditions (if the `drsti-dev-flow` plugin is active).
3. Spawns each mission's agent adapter and waits for it to complete.
4. Checks the merge gate between missions, with an interactive retry loop so you can update `workstreams.json` in place.
5. Prints a branch summary when all missions are done.

**`--simulate` mode** runs the full terminal experience — headers, gate checks, mission progress, branch summary — without spawning any real agents or touching your repo. Use it to preview what a template will do before committing to a full run.

| Flag | Description |
|------|-------------|
| `--template <name>` | Built-in mission template to run (required) |
| `--simulate` | Simulate the run without real agents (UAT / preview mode) |
| `--cwd <path>` | Working directory (default: current directory) |
| `--agent <adapter>` | Override the agent adapter for all missions |

See [Mission Templates](/templates/) for available templates.

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

## fleet web

Start the browser-based Fleet web dashboard.

```bash
fleet web
```

The dashboard shows mission board, ship health, merge queue, and mission logs in real time via Server-Sent Events. Accessible from any browser including mobile — the command prints both local and LAN URLs.

| Flag | Description |
|------|-------------|
| `-p, --port <port>` | HTTP port (default: 4000) |
| `-H, --host <host>` | Bind address (default: 0.0.0.0) |
| `--poll <ms>` | Poll interval in milliseconds (default: 15000) |
| `--no-open` | Do not open browser automatically |

---

## fleet demo

Run a zero-friction simulated fleet — no repo, no agents, no network required.

```bash
fleet demo
# or
npx fleetspark demo
```

Simulates a complete fleet run with 4 missions, showing planning, ship assignment, parallel execution, dependency unblocking, and auto-merge. The ideal way to see Fleet in action before setting up a real fleet.

---

## fleet report

Generate a markdown summary of the current or most recent fleet run.

```bash
# Print to stdout
fleet report

# Machine-readable JSON
fleet report --json

# Write to a file
fleet report --output run-report.md
```

The report includes mission outcomes, timing, ships used, merge status, and an estimated time saved vs. sequential execution.

| Flag | Description |
|------|-------------|
| `--json` | Output machine-readable JSON instead of markdown |
| `--output <file>` | Write report to a file |

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

---

## fleet plugin

Manage Fleet plugins — install governance layers, integrations, and extensions.

```bash
# Install a plugin and register it in .fleet/config.yml
fleet plugin install @fleetspark/plugin-drsti-dev-flow

# List registered plugins
fleet plugin list
```

Plugins are loaded automatically on every `fleet ship --join` and during merge operations. They can block missions from starting or block PRs from being created based on project-defined rules.

**Installing drsti-dev-flow governance:**

```bash
fleet plugin install @fleetspark/plugin-drsti-dev-flow
```

This registers the plugin in `.fleet/config.yml`:

```yaml
plugins:
  - name: "@fleetspark/plugin-drsti-dev-flow"
```

From that point on, Fleet enforces review gates before impl missions start and before PRs are created — based on the maturity level in each workstream's `workstreams.json` entry.

See [Ecosystem](/ecosystem/) for the full plugin architecture.
