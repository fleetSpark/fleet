---
title: Configuration
description: Fleet configuration reference for .fleet/config.yml.
---

Fleet is configured through `.fleet/config.yml` in your repository root. Created by `fleet init`.

## Full reference

```yaml
# .fleet/config.yml

commander:
  model: claude-opus-4-5      # LLM for commander planning (BYOK)
  poll_interval_minutes: 5     # How often commander checks ship progress
  max_concurrent_ships: 8      # Maximum number of active ships

execution:
  strategy: mapreduce          # sequential | mapreduce
  stall_threshold_min: 30      # Mark ship dead after this many minutes
  unresponsive_threshold_min: 10  # Mark ship stale after this many minutes
  shadow_dispatch: false       # Enable parallel re-dispatch for stalled ships
  shadow_delay_min: 15         # Minutes before shadow dispatch triggers

heartbeat:
  interval_seconds: 60         # Ship heartbeat push interval
  squash_on_complete: true     # Squash heartbeat commits on mission completion

merge:
  ci_required: true            # Require CI pass before auto-merge
  auto_rebase: true            # Attempt rebase on merge conflicts

brief:
  mode: static                 # static | llm — FLEET_CONTEXT.md generation mode

resources:
  max_missions_per_ship: 1     # Max concurrent missions per ship
  mission_timeout_min: 120     # Mission timeout in minutes

notifications:
  webhooks:
    - url: https://hooks.slack.com/services/xxx
      format: slack            # json | slack
      events:                  # Optional filter (all events if omitted)
        - pr-merged
        - ci-failed
        - all-missions-complete

ships:
  - id: ship-a
    adapter: claude-code       # claude-code | codex | aider | opencode | a2a
  - id: ship-b
    adapter: codex
```

## Commander settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `model` | string | `claude-opus-4-5` | LLM model for planning and coordination |
| `poll_interval_minutes` | number | `5` | How often the commander checks for updates |
| `max_concurrent_ships` | number | `8` | Maximum number of active ships |

## Execution settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `strategy` | string | `mapreduce` | `sequential` or `mapreduce` |
| `stall_threshold_min` | number | `30` | Minutes before a ship is marked dead |
| `unresponsive_threshold_min` | number | `10` | Minutes before a ship is marked stale |
| `shadow_dispatch` | boolean | `false` | Re-dispatch stalled missions to another ship |
| `shadow_delay_min` | number | `15` | Minutes before shadow dispatch activates |

## Heartbeat settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `interval_seconds` | number | `60` | Heartbeat push interval in seconds |
| `squash_on_complete` | boolean | `true` | Squash heartbeat commits when mission completes |

## Merge settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ci_required` | boolean | `true` | Require CI pass before auto-merge |
| `auto_rebase` | boolean | `true` | Attempt rebase on merge conflicts |

## Brief settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `mode` | string | `static` | `static` (file analysis) or `llm` (AI-powered summary) |

## Resource limits

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `max_missions_per_ship` | number | `1` | Maximum concurrent missions per ship |
| `mission_timeout_min` | number | `120` | Mission timeout in minutes |

## Notification webhooks

| Key | Type | Description |
|-----|------|-------------|
| `url` | string | Webhook endpoint URL |
| `format` | string | `json` (raw event) or `slack` (Slack message format) |
| `events` | string[] | Optional filter — only send these event types |

### Available event types

| Event | Description |
|-------|-------------|
| `mission-completed` | A ship finished its mission |
| `pr-created` | Commander created a PR for a completed mission |
| `pr-merged` | PR was merged into main |
| `ci-failed` | CI checks failed on a mission branch |
| `ship-stalled` | A ship stopped sending heartbeats |
| `shadow-dispatched` | Commander re-dispatched a stalled mission |
| `conflict-detected` | File conflicts detected between branches |
| `all-missions-complete` | All missions in the fleet are done |

## Ship configuration

Each entry in `ships` defines a machine in the fleet.

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Unique identifier for this ship |
| `adapter` | string | Coding agent adapter: `claude-code`, `codex`, `aider`, `opencode`, or `a2a` |
