---
title: Getting Started
description: Get up and running with Fleet in under 5 minutes.
---

Fleet turns your idle machines into a coordinated AI coding workforce. Here's how to start.

## See it first (30 seconds)

Before setting anything up, run the demo — no repo, no agents, no network required:

```bash
npx fleetspark demo
```

This simulates a complete 4-mission fleet run so you can see exactly how planning, ship assignment, parallel execution, and auto-merge work.

Or preview a specific template before running it for real:

```bash
npx fleetspark run --template drsti-dev-flow --simulate
npx fleetspark run --template test-coverage --simulate
```

`--simulate` shows the full terminal experience — mission headers, gate checks, branch summary — without touching your repo or needing any agent installed.

---

## Prerequisites

- **Node.js 18+** on every machine
- **Git** with push access to the same GitHub repository
- A **coding agent** installed on each machine (Claude Code, Codex, Aider, OpenCode, Gemini CLI, Cursor, Amp, or any A2A-compatible agent)

## Initialize your repo

On the machine that will be your commander:

```bash
cd your-project
npx fleetspark init
```

This creates `.fleet/config.yml` and the `fleet/state` branch with an empty `FLEET.md`.

## Plan your work

```bash
# Use an LLM to decompose a natural language goal
npx fleetspark command --plan "Add OAuth login, fix the rate limiter, update API docs"

# Use a built-in template (no API key needed)
npx fleetspark command --template test-coverage

# Load a pre-defined YAML plan
npx fleetspark command --plan-file missions.yml
```

The commander decomposes your goal into independent missions with dependencies, creates branches, and writes the plan to `FLEET.md`. Templates give you a ready-to-run plan with no LLM required — see [Mission Templates](/templates/) for all six built-in options.

## Join the fleet

On any other machine:

```bash
npx fleetspark ship --join git@github.com:you/your-project.git
```

The ship clones the repo, reads its assigned mission from `FLEET.md`, starts the coding agent, and begins pushing heartbeats every 60 seconds.

## Watch progress

```bash
# Interactive terminal dashboard
npx fleetspark dashboard

# Simple text output
npx fleetspark status --watch

# Machine-readable JSON
npx fleetspark status --json
```

The dashboard shows every ship's status, health, progress, merge queue, and blockers — updated in real time.

## What happens next

1. Each ship works on its own branch, pushing progress every 60 seconds
2. The commander monitors heartbeats, detects stalled ships, and handles failures
3. Completed missions enter the merge queue — conflict detection runs, CI checks pass
4. PRs are created automatically and auto-merged when clean
5. Dependent missions are unblocked and dispatched to the next available ship
6. You wake up to merged code — or PRs waiting for your approval

## Configuration

Fleet is configured via `.fleet/config.yml`. See the [Configuration reference](/configuration/) for all options, including:

- Agent selection per ship (Claude Code, Codex, Aider, OpenCode, Gemini CLI, Cursor, Amp, A2A)
- Shadow dispatch for stalled ship recovery
- Webhook notifications (Slack, custom)
- Resource limits (per-ship concurrency, mission timeouts)

## After a run

Generate a markdown summary of what happened:

```bash
npx fleetspark report
```

Includes mission outcomes, timing, ships used, and an estimate of how much time running in parallel saved vs. sequential execution.

## Next steps

- [Mission Templates](/templates/) — start a fleet without writing a plan
- [GitHub Action](/github-action/) — run Fleet in CI without extra machines
- [Architecture](/architecture/) — understand how Fleet works under the hood
- [Adapters](/adapters/) — which coding agents are supported
- [CLI Reference](/cli-reference/) — all available commands
- [FAQ](/faq/) — common questions answered
