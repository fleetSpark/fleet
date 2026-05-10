---
title: GitHub Action
description: Run Fleet operations in CI workflows — use GitHub-hosted runners as ships.
---

The `fleetspark/fleet-action` GitHub Action lets you run fleet operations inside GitHub Actions workflows. GitHub-hosted runners become your ships — no extra machines required.

## When to use it

- You want to try Fleet without setting up multiple physical machines
- Your CI already runs on GitHub Actions and you want fleet runs triggered by PRs or schedules
- You want to automate a recurring fleet task (weekly dependency updates, nightly test coverage runs)

## Installation

No installation needed. Reference the action directly in your workflow:

```yaml
uses: fleetspark/fleet-action@v1
```

## Basic example

```yaml
# .github/workflows/fleet.yml
name: Fleet Run

on:
  workflow_dispatch:
    inputs:
      plan:
        description: 'Goal to decompose into missions'
        required: false
        default: ''
      template:
        description: 'Built-in template name (test-coverage, security-audit, api-docs, dependency-update, refactor, drsti-dev-flow)'
        required: false
        default: ''

jobs:
  # Step 1: Commander plans the missions
  fleet-plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: fleetspark/fleet-action@v1
        with:
          command: plan
          plan: ${{ github.event.inputs.plan }}
          template: ${{ github.event.inputs.template }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

  # Step 2: Ships execute in parallel
  fleet-ship:
    needs: fleet-plan
    runs-on: ubuntu-latest
    strategy:
      matrix:
        ship: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - uses: fleetspark/fleet-action@v1
        with:
          command: ship
          agent: claude-code
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Template-based run (no API key for planning)

Using a built-in template skips LLM decomposition — no `ANTHROPIC_API_KEY` needed for the plan step:

```yaml
- uses: fleetspark/fleet-action@v1
  with:
    command: plan
    template: test-coverage
```

## Inputs

| Input | Description | Required |
|-------|-------------|----------|
| `command` | Operation to run: `init`, `plan`, `ship`, `status`, `report` | Yes |
| `plan` | Natural language goal (used with `command: plan`) | No |
| `template` | Built-in template name (used with `command: plan`) | No |
| `agent` | Coding agent to use (used with `command: ship`): `claude-code`, `codex`, `aider`, `opencode`, `gemini`, `cursor`, `amp` | No |
| `repo` | Git URL of the repository (defaults to current repo) | No |

## Generating a run report

Add a report step at the end of your workflow:

```yaml
  fleet-report:
    needs: fleet-ship
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: fleetspark/fleet-action@v1
        with:
          command: report
      - uses: actions/upload-artifact@v4
        with:
          name: fleet-report
          path: fleet-report.md
```

## Secrets

| Secret | When needed |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Required when using `--plan` with LLM decomposition |
| `GH_TOKEN` | Required for the action to create PRs (auto-provided by Actions as `GITHUB_TOKEN`) |

## Limitations

- GitHub-hosted runners are ephemeral — each ship starts from a fresh checkout
- No persistent state between runs beyond what's committed to the `fleet/state` branch
- Free-tier GitHub Actions concurrency limits apply to the matrix strategy
- Agent setup (Claude Code, Codex, etc.) must be handled in your workflow steps before the ship command

## Source

The action source is in the `action/` directory at the root of the [FleetSpark repository](https://github.com/fleetSpark/fleet).
