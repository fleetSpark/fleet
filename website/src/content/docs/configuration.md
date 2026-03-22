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

execution:
  strategy: spark              # sequential | mapreduce | spark
  stall_threshold_min: 30      # Shadow dispatch after this many minutes of no heartbeat

merge:
  ci_required: true            # Require CI pass before merge queue
  notify: terminal             # terminal | slack

ships:
  - id: ship-a
    adapter: claude            # claude | codex | aider | a2a
    mode: local                # local | remote
```

## Commander settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `model` | string | `claude-opus-4-5` | LLM model for the commander's planning and coordination |
| `poll_interval_minutes` | number | `5` | How often the commander checks for ship updates |

## Execution strategies

| Strategy | Description |
|----------|-------------|
| `sequential` | One mission at a time, in dependency order |
| `mapreduce` | All independent missions in parallel, then dependent ones |
| `spark` | Parallel DAG + shadow dispatch + fleet brief (recommended) |

## Merge settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ci_required` | boolean | `true` | Whether CI must pass before entering merge queue |
| `notify` | string | `terminal` | Where to send merge notifications |

## Ship configuration

Each entry in `ships` defines a machine in the fleet.

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Unique identifier for this ship |
| `adapter` | string | Which coding agent adapter to use |
| `mode` | string | `local` (same network) or `remote` (any machine with GitHub access) |
