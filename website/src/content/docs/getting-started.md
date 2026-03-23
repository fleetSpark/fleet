---
title: Getting Started
description: Get up and running with Fleet in under 5 minutes.
---

Fleet turns your idle machines into a coordinated AI coding workforce. Here's how to start.

## Prerequisites

- **Node.js 18+** on every machine
- **Git** with push access to the same GitHub repository
- A **coding agent** installed on each machine (Claude Code, Codex, Aider, OpenCode, or any A2A-compatible agent)

## Initialize your repo

On the machine that will be your commander:

```bash
cd your-project
npx fleet init
```

This creates `.fleet/config.yml` and the `fleet/state` branch with an empty `FLEET.md`.

## Plan your work

```bash
npx fleet command --plan "Add OAuth login, fix the rate limiter, update API docs"
```

The commander uses an LLM to decompose your goal into independent missions with dependencies, creates branches, and writes the plan to `FLEET.md`.

You can also load a pre-defined plan from a YAML file:

```bash
npx fleet command --plan-file missions.yml
```

## Join the fleet

On any other machine:

```bash
npx fleet ship --join git@github.com:you/your-project.git
```

The ship clones the repo, reads its assigned mission from `FLEET.md`, starts the coding agent, and begins pushing heartbeats every 60 seconds.

## Watch progress

```bash
# Interactive terminal dashboard
npx fleet dashboard

# Simple text output
npx fleet status --watch

# Machine-readable JSON
npx fleet status --json
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

- Agent selection per ship (Claude Code, Codex, Aider, OpenCode, A2A)
- Shadow dispatch for stalled ship recovery
- Webhook notifications (Slack, custom)
- Resource limits (per-ship concurrency, mission timeouts)

## Next steps

- [Architecture](/architecture/) — understand how Fleet works under the hood
- [Adapters](/adapters/) — which coding agents are supported
- [CLI Reference](/cli-reference/) — all available commands
- [FAQ](/faq/) — common questions answered
