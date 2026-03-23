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
│  1.5 Shadow      │──reads────────▶│   MISSION.md      │               │  2. Run agent │
│  2. Merge check  │                │   task_brief.json │               │  3. Heartbeat │
│  3. DAG resolve  │                │   (source code)   │               │  4. Complete  │
│  4. Write state  │                │                   │                └──────────────┘
│                  │                │ main branch       │
│ Subsystems:      │                │   FLEET_CONTEXT.md│
│  • Election      │                │   .fleet/config   │
│  • Notifications │                └──────────────────┘
│  • Telemetry     │
│  • Resources     │
└─────────────────┘
```

---

## Package structure

Fleet is an npm workspaces monorepo:

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/core` | `@fleet/core` | Protocol library — types, parsers, state machine, scheduler, git ops, heartbeat, merge, notifications, telemetry, election |
| `packages/cli` | `fleetspark` | The CLI tool users install — all `fleet` commands |
| `packages/adapters/claude` | `@fleet/adapter-claude` | Claude Code adapter |
| `packages/adapters/codex` | `@fleet/adapter-codex` | Codex CLI adapter |
| `packages/adapters/aider` | `@fleet/adapter-aider` | Aider adapter |
| `packages/adapters/opencode` | `@fleet/adapter-opencode` | OpenCode adapter |
| `packages/adapters/gemini` | `@fleet/adapter-gemini` | Gemini CLI adapter |
| `packages/adapters/cursor` | `@fleet/adapter-cursor` | Cursor adapter |
| `packages/adapters/amp` | `@fleet/adapter-amp` | Amp adapter |
| `packages/adapters/a2a` | `@fleet/adapter-a2a` | A2A protocol adapter (any A2A-compatible agent) |

```
fleet/
├── packages/
│   ├── core/src/
│   │   ├── protocol/       Types, FLEET.md + MISSION.md parsers/writers
│   │   ├── state/          Mission state machine (10 states, 12 events)
│   │   ├── scheduler/      DAG scheduler with cycle detection
│   │   ├── config/         Zod schema + YAML config loader
│   │   ├── git/            GitOps interface (clone, branch, PR lifecycle)
│   │   ├── heartbeat/      Ship heartbeat + commander monitor
│   │   ├── merge/          Merge commander + conflict detector
│   │   ├── brief/          FLEET_CONTEXT.md generator (static + LLM)
│   │   ├── adapters/       Adapter registry (resolveAdapter)
│   │   ├── election/       Commander election protocol
│   │   ├── notifications/  Webhook/Slack notifier
│   │   ├── telemetry/      Mission throughput + ship utilization
│   │   └── resources/      Ship resource limits + concurrency caps
│   │
│   ├── cli/src/
│   │   └── commands/       init, status, command, ship, assign, brief, logs
│   │
│   └── adapters/
│       ├── claude/         Spawns claude process
│       ├── codex/          Spawns codex --full-auto
│       ├── aider/          Spawns aider --yes-always
│       ├── opencode/       Spawns opencode --non-interactive
│       ├── gemini/         Spawns gemini CLI
│       ├── cursor/         Spawns cursor CLI
│       ├── amp/            Spawns amp CLI
│       └── a2a/            JSON-RPC A2A protocol client
│
├── tests/
│   ├── unit/               230+ unit tests by module
│   └── integration/        Tests against real local git repos
│
├── website/                Astro Starlight documentation site
│
└── .github/workflows/      CI + npm publish
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
| 10-30 minutes | Stale | Warning, shadow dispatch if enabled |
| > 30 minutes | Dead | Mark mission as stalled |

No explicit health messages — the heartbeat is the signal.

---

## Merge commander

Drives the post-completion lifecycle automatically:

1. Mission reaches `completed` status
2. **Conflict detection** — checks file overlap with other active branches
3. Commander creates a PR from the mission branch to `main`, noting any conflicts in the PR body
4. Mission transitions to `merge-queued`
5. Commander monitors CI status:
   - **CI passes, no conflicts** — auto-merge to `main`
   - **CI passes, merge conflict** — attempt rebase if configured, otherwise flag for human
   - **CI fails** — reject back to `in-progress` for rework

---

## Commander monitor loop

The commander polls every 5 minutes (configurable). Each cycle runs phases in order:

1. **Health check** — read each ship's MISSION.md, classify alive/stale/dead
2. **Shadow dispatch** — if enabled, re-dispatch stalled missions to another ship after configurable delay
3. **Merge check** — handle completed missions through the PR/CI/merge lifecycle
4. **DAG resolve** — promote newly unblocked missions to `ready`
5. **Single atomic write** — push updated FLEET.md if anything changed

This ordering means a mission merged in phase 3 has its dependents promoted in phase 4 of the same cycle.

---

## Commander election

Multiple machines can run as commander candidates. The election protocol ensures exactly one active commander:

- **Claim check** — verify current commander is timed out or missing before claiming
- **Optimistic locking** — read FLEET.md → check → write → push. If push fails, another node won.
- **Heartbeat** — active commander updates its checkin timestamp regularly
- **Graceful release** — commander can release leadership on shutdown

If the active commander crashes, another candidate automatically takes over after the timeout period.

---

## Notifications

Fleet can send webhook notifications for key events:

- Mission completed, PR created/merged, CI failed
- Ship stalled, shadow dispatched, conflicts detected
- All missions complete

Supports raw JSON payloads and Slack-formatted messages. Configure in `.fleet/config.yml` under `notifications.webhooks`.

---

## Resource management

The ResourceManager enforces fleet-wide limits:

- **Per-ship concurrency** — maximum missions running on a single ship (default: 1)
- **Global ship cap** — maximum number of active ships (default: 8)
- **Mission timeout** — auto-detect timed-out missions (default: 120 minutes)

---

## Telemetry

The TelemetryCollector tracks fleet health metrics:

- **Mission counts** — pending, in-progress, completed, failed, merged
- **Ship utilization** — active vs idle ships as a percentage
- **Throughput** — completed missions per hour, average mission duration

Use `fleet status --json` for machine-readable telemetry data.

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

Fleet ships with adapters for Claude Code, Codex, Aider, OpenCode, Gemini CLI, Cursor, Amp, and A2A.

See [Adapters](/adapters/) for implementation details.

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
   → Health check → Shadow dispatch → Merge check → DAG resolve → Write state
   → Notifications sent for key events

4. Ship completes mission
   → Sets MISSION.md status to completed
   → Commander detects conflicts, creates PR → CI runs → auto-merge if clean
   → Dependent missions become ready
   → Webhook notifications sent
```

---

## Design principles

1. **Git is the only bus** — no SSH, no shared filesystem, no websockets
2. **Markdown is the protocol** — human-readable, diffable, debuggable
3. **State machine as law** — all transitions validated, invalid moves fail fast
4. **Optimistic concurrency** — no locks, push retries with rebase on conflict
5. **Heartbeat-based liveness** — commander infers health from push timestamps
6. **Commander is replaceable** — full state lives in git, any machine can resume
7. **Adapter pattern** — any coding agent integrates via a thin wrapper
8. **Resource-aware** — per-ship and fleet-wide limits prevent overload
