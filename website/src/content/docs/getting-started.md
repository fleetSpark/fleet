---
title: Getting Started
description: Get up and running with Fleet in under 5 minutes.
---

Fleet turns your idle machines into a coordinated AI coding workforce. Here's how to start.

## Prerequisites

- **Node.js 18+** on every machine
- **Git** with push access to the same GitHub repository
- A **coding agent** installed on each machine (Claude Code, Codex, Aider, or any A2A-compatible agent)

## Initialize your repo

On the machine that will be your commander:

```bash
cd your-project
npx fleet init
```

This creates `FLEET.md` and `.fleet/config.yml` in your repo.

## Plan your work

```bash
npx fleet command --plan "Add OAuth login, fix the rate limiter, update API docs"
```

The commander decomposes your goal into independent missions, each assigned to a ship.

## Join the fleet

On any other machine:

```bash
npx fleet ship --join git@github.com:you/your-project.git
```

The ship clones the repo, reads its assigned mission from `FLEET.md`, and starts working autonomously.

## Watch progress

```bash
npx fleet status --watch
```

The mission board shows every ship's status, progress, and any blockers — updated in real time.

## What happens next

1. Each ship works on its own branch, pushing progress every 60 seconds
2. The commander monitors heartbeats, unblocks stalled ships, and handles failures
3. Completed missions enter the merge queue — CI runs, conflicts are resolved
4. You wake up to PRs waiting for your approval

Fleet never merges without human sign-off.
