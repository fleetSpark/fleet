---
title: Architecture
description: How Fleet's packages, protocols, and subsystems fit together.
---

Fleet is a Map-Reduce system for software development. A **commander** decomposes work into missions. **Ships** (worker machines) execute missions independently on their own git branches. The commander monitors progress, handles failures, and merges completed work.

**GitHub is the only message bus** — no SSH, no shared filesystem, no direct inter-machine communication. If a machine can push to GitHub, it can join the fleet.

---

## System overview

```
Commander machine                    GitHub (message bus)                  Ship machines
┌─────────────────┐                 ┌──────────────────┐                 ┌──────────────┐
│ fleet command    │──writes───────▶│ fleet/state branch│◀──reads────────│ fleet ship   │
│                  │                │   FLEET.md        │                │              │
│ Monitor loop:    │                │                   │                │ Per mission:  │
│  1. Health check │                │ feature/* branches│◀──writes──────│  1. Clone repo│
│  2. Merge check  │──reads────────▶│   MISSION.md      │               │  2. Run agent │
│  3. DAG resolve  │                │   task_brief.json │               │  3. Heartbeat │
│  4. Write state  │                │   (source code)   │               │  4. Complete  │
└─────────────────┘                 │                   │                └──────────────┘
                                    │ main branch       │
                                    │   FLEET_CONTEXT.md│
                                    │   .fleet/config   │
                                    └──────────────────┘
```

---

## Package structure

Fleet is an npm workspaces monorepo with three packages:

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/core` | `@fleet/core` | Protocol library — types, parsers, state machine, scheduler, git ops, heartbeat |
| `packages/cli` | `fleet-cli` | The CLI tool users install — all `fleet` commands |
| `packages/adapters/claude` | `@fleet/adapter-claude` | Claude Code adapter — spawns and manages Claude processes |

```
fleet/
├── packages/
│   ├── core/src/
│   │   ├── protocol/     Types, FLEET.md + MISSION.md parsers/writers
│   │   ├── state/        Mission state machine
│   │   ├── scheduler/    DAG scheduler with cycle detection
│   │   ├── config/       Zod schema + YAML config loader
│   │   ├── git/          GitOps interface + implementation
│   │   ├── heartbeat/    Ship heartbeat + commander monitor
│   │   ├── merge/        Merge commander (auto-merge lifecycle)
│   │   └── brief/        FLEET_CONTEXT.md generator
│   │
│   ├── cli/src/
│   │   └── commands/     init, status, command, ship, assign, brief, logs
│   │
│   └── adapters/claude/  Spawns claude process, tracks PIDs
│
├── tests/
│   ├── unit/             70+ unit tests by module
│   └── integration/      Tests against real local git repos
│
└── .github/workflows/    CI + npm publish
```

---

## Protocol layer

Fleet coordinates through two plain Markdown files. Human-readable, diffable, debuggable with `cat`.

### FLEET.md

Lives on the `fleet/state` orphan branch. Written by the commander. Read by all ships.

Contains:
- Commander info (host, status, last checkin)
- Active missions table (ID, branch, ship, agent, status, dependencies, blockers)
- Merge queue (missions awaiting CI/merge)
- Completed section (merged missions with dates)

### MISSION.md

Lives on each ship's feature branch. Written by the ship every 60 seconds as a heartbeat.

Contains:
- Ship/agent/status header
- Mission brief (task description)
- Steps with checkbox progress
- Blockers
- Heartbeat timestamp

Both files have round-trip fidelity: `parse()` then `write()` preserves structure.

See [Protocol Specification](/protocol/) for the full schema.

---

## Mission state machine

All status transitions go through a validated state machine. Invalid moves throw errors immediately.

```
pending ──dependencies_met──▶ ready ──assign──▶ assigned ──start──▶ in-progress
                                                                      │
                              ┌──────────unblock───── blocked ◀──block─┤
                              │                                        │
                              ├──────────unstall───── stalled ◀──stall─┤
                              │                                        │
                              │                       failed ◀───fail──┤
                              ▼                                        │
                          in-progress ◀──reject── merge-queued ◀───────┤
                              │                       │         queue_merge
                              └──complete──▶ completed─┘
                                                          merge
                                                    merge-queued ──▶ merged
```

**10 states, 12 events.** Terminal states: `merged` and `failed`.

---

## DAG scheduler

Missions can declare dependencies on other missions. The scheduler handles:

- **Cycle detection** — DFS validation at plan time. Circular dependencies are rejected.
- **Ready resolution** — finds pending missions whose dependencies are all in terminal state (completed or merged) and promotes them to `ready`.

---

## Heartbeat system

Ships push MISSION.md on a configurable interval (default 60 seconds) even when no progress has been made. The commander infers health from push timestamps:

| Last push age | Status | Commander action |
|---------------|--------|-----------------|
| < 10 minutes | Alive | None |
| 10-30 minutes | Stale | Warning |
| > 30 minutes | Dead | Mark mission as stalled |

No explicit health messages — the heartbeat is the signal.

---

## Merge commander

Drives the post-completion lifecycle automatically:

1. Mission reaches `completed` status
2. Commander creates a PR from the mission branch to `main`
3. Mission transitions to `merge-queued`
4. Commander monitors CI status:
   - **CI passes, no conflicts** — auto-merge to `main`
   - **CI passes, merge conflict** — attempt rebase if configured, otherwise flag for human
   - **CI fails** — reject back to `in-progress` for rework

---

## Commander monitor loop

The commander polls every 5 minutes (configurable). Each cycle runs three phases in order:

1. **Health check** — read each ship's MISSION.md, classify alive/stale/dead
2. **Merge check** — handle completed missions through the PR/CI/merge lifecycle
3. **DAG resolve** — promote newly unblocked missions to `ready`
4. **Single atomic write** — push updated FLEET.md if anything changed

This ordering means a mission merged in phase 2 has its dependents promoted in phase 3 of the same cycle.

---

## Branch topology

```
main ──────────────────────────────────────────────▶
  │                                        ▲  ▲
  ├── feature/auth (ship-a) ──────────────┘  │
  ├── feature/ratelimiter (ship-b) ──────────┘
  │
fleet/state (orphan, never merged to main)
  └── FLEET.md only
```

Each mission runs on its own branch. The `fleet/state` branch is an orphan — it exists solely for coordination state and is never merged.

---

## Adapter interface

Any coding agent integrates via a thin adapter:

```typescript
interface FleetAdapter {
  name: string;
  start(mission, context): Promise<AgentSession>;
  isAlive(session): Promise<boolean>;
  send(session, message): Promise<void>;
  stop(session): Promise<void>;
}
```

See [Writing a Fleet Adapter](/adapters/) for implementation details.

---

## Data flow: mission lifecycle

```
1. fleet command --plan "goal"
   → LLM decomposes goal into missions with dependencies
   → Creates branches, MISSION.md, task_brief.json per mission
   → Writes FLEET.md to fleet/state

2. fleet ship --join <repo>
   → Clones repo, reads FLEET.md
   → Finds first ready/assigned mission
   → Starts coding agent via adapter
   → Starts heartbeat (pushes MISSION.md every 60s)

3. Commander monitor loop (every 5 min)
   → Health check → Merge check → DAG resolve → Write state

4. Ship completes mission
   → Sets MISSION.md status to completed
   → Commander creates PR → CI runs → auto-merge if clean
   → Dependent missions become ready
```

---

## Design principles

1. **Git is the only bus** — no SSH, no shared filesystem, no websockets
2. **Markdown is the protocol** — human-readable, diffable, debuggable
3. **State machine as law** — all transitions validated, invalid moves fail fast
4. **Optimistic concurrency** — no locks, push retries with rebase on conflict
5. **Heartbeat-based liveness** — commander infers health from push timestamps
6. **Commander is replaceable** — full state lives in git, any machine can resume
