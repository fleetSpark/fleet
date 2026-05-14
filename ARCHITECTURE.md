# Fleet Architecture

> System architecture for the Fleet distributed AI coding agent orchestrator.

---

## High-level overview

Fleet is a Map-Reduce system for software development. A **commander** decomposes work into missions. **Ships** (worker machines) execute missions independently on their own git branches. The commander monitors progress, handles failures, and merges completed work. **GitHub is the only message bus** — no SSH, no shared filesystem, no direct inter-machine communication.

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

npm workspaces monorepo with three packages:

```
fleet/
├── packages/
│   ├── core/              @fleetspark/core — protocol library
│   │   └── src/
│   │       ├── protocol/  Types, FLEET.md parser/writer, MISSION.md parser/writer
│   │       ├── state/     Mission state machine (10 states, validated transitions)
│   │       ├── scheduler/ DAG scheduler with cycle detection
│   │       ├── config/    Zod schema + YAML config loader
│   │       ├── git/       GitOps interface + RealGitOps implementation
│   │       ├── heartbeat/ ShipHeartbeat timer + CommanderMonitor
│   │       ├── merge/     MergeCommander (v0.2)
│   │       └── brief/     BriefGenerator (v0.2)
│   │
│   ├── cli/               fleetspark — the CLI tool users install
│   │   └── src/
│   │       ├── index.ts   Entry point, registers all commands
│   │       └── commands/  init, status, command, ship, assign, brief (v0.2), logs (v0.2)
│   │
│   └── adapters/
│       ├── claude/        @fleetspark/adapter-claude — Claude Code adapter
│       ├── codex/         @fleetspark/adapter-codex — OpenAI Codex adapter
│       ├── aider/         @fleetspark/adapter-aider — Aider adapter
│       ├── opencode/      @fleetspark/adapter-opencode — OpenCode adapter
│       ├── gemini/        @fleetspark/adapter-gemini — Gemini CLI adapter
│       ├── cursor/        @fleetspark/adapter-cursor — Cursor CLI adapter
│       ├── amp/           @fleetspark/adapter-amp — Amp CLI adapter
│       └── a2a/           @fleetspark/adapter-a2a — A2A protocol adapter
│           └── src/
│               └── index.ts  Spawns claude process, tracks PIDs
│
├── tests/
│   ├── unit/              70+ unit tests organized by module
│   └── integration/       Integration tests against real local git repos
│
├── .github/workflows/     CI (Node 18/20/22) + npm publish (v0.2)
├── protocol.md            Protocol spec v1.0
├── ROADMAP.md             Versioned milestone tracker
└── ARCHITECTURE.md        This file
```

---

## Core subsystems

### 1. Protocol layer (`packages/core/src/protocol/`)

The protocol defines two Markdown files that serve as the communication contract:

**FLEET.md** — lives on the `fleet/state` orphan branch. Written by the commander. Read by all ships.
- Commander info (host, status, last checkin)
- Active missions table (ID, branch, ship, agent, status, depends, blocker)
- Merge queue (missions awaiting CI/merge)
- Completed section (merged missions with dates)

**MISSION.md** — lives on each ship's feature branch. Written by the ship every 60 seconds as a heartbeat.
- Ship/agent/status header
- Mission brief (task description)
- Steps with checkbox progress
- Blockers
- Heartbeat timestamp

Both files have round-trip fidelity: `parse()` → modify → `write()` preserves structure.

### 2. State machine (`packages/core/src/state/`)

All mission status transitions go through `transition(current, event)`. Invalid transitions throw errors (fail-fast). This is the single source of truth for what moves are legal.

```
pending ──dependencies_met──▶ ready ──assign──▶ assigned ──start──▶ in-progress
                                                                      │
                              ┌──────────unblock───── blocked ◀──block─┤
                              │                                        │
                              ├──────────unstall───── stalled ◀──stall─┤
                              │                                        │
                              │                       failed ◀───fail──┤ (also from blocked/stalled)
                              ▼                                        │
                          in-progress ◀──reject── merge-queued ◀───────┤
                              │                       │         queue_merge
                              └──complete──▶ completed─┘
                                                          merge
                                                    merge-queued ──▶ merged
```

### 3. DAG scheduler (`packages/core/src/scheduler/`)

Missions can declare dependencies on other missions. The scheduler:
- `validateDAG(missions)` — DFS cycle detection, throws on cycles
- `getReadyMissions(missions)` — returns pending missions whose dependencies are all in terminal state (completed/merged)

### 4. Git operations (`packages/core/src/git/`)

`GitOps` interface abstracts all git interactions. `RealGitOps` implements via `child_process.execFile`.

Key design decisions:
- `readFile(branch, path)` uses `git show` — reads from any branch without checkout
- `writeAndPush()` has 3-attempt retry with `pull --rebase` on conflict
- `createOrphanBranch()` creates branches with no history (for fleet/state)
- v0.2 adds: `createPR`, `getPRStatus`, `mergePR` (via `gh` CLI), `fetchBranch`

### 5. Heartbeat system (`packages/core/src/heartbeat/`)

**Ship side** — `ShipHeartbeat` pushes MISSION.md on a configurable interval (default 60s), even when no progress has been made. This serves as a liveness signal.

**Commander side** — `CommanderMonitor.poll()` reads each ship's MISSION.md and classifies health:

| Last push age | Status | Action |
|---------------|--------|--------|
| < 10 minutes | alive | None |
| 10-30 minutes | stale | Warning |
| > 30 minutes | dead | Mark mission as stalled |

### 6. Merge commander (`packages/core/src/merge/`) — v0.2

`MergeCommander` drives the post-completion lifecycle:

```
completed ──▶ create PR ──▶ merge-queued ──▶ check CI ──▶ merge ──▶ merged
                                              │
                                              ├── CI fails → reject → in-progress
                                              ├── conflict + auto_rebase → rebase → re-check
                                              └── conflict + no rebase → blocker → human
```

Called from the monitor loop's tick cycle. Returns `MergeResult[]` — never writes FLEET.md directly (single atomic write per cycle).

### 7. Brief generator (`packages/core/src/brief/`) — v0.2

Generates `FLEET_CONTEXT.md` so ships skip the codebase exploration phase:
- **Static mode** (default): directory tree, dependencies, file counts, conventions, active branches
- **LLM mode** (`--llm`): sends static analysis to Claude for architecture narrative

---

## Data flow

### Mission lifecycle

```
1. User runs: fleet command --plan "goal"
   └── LLM decomposes goal → missions with dependencies
   └── Creates branches, MISSION.md, task_brief.json per mission
   └── Writes FLEET.md to fleet/state

2. Ship runs: fleet ship --join <repo>
   └── Clones repo, reads FLEET.md
   └── Finds first ready/assigned mission
   └── Starts coding agent (adapter)
   └── Starts heartbeat timer (pushes MISSION.md every 60s)

3. Commander monitor loop (every 5 min):
   └── Phase 1: Health check — read each ship's MISSION.md, classify alive/stale/dead
   └── Phase 2: Merge check — handle completed missions (PR → CI → merge)
   └── Phase 3: DAG resolve — promote newly unblocked missions to ready
   └── Single atomic FLEET.md write if anything changed

4. Ship completes mission:
   └── Sets MISSION.md status to completed
   └── Commander detects on next poll
   └── Merge commander creates PR, monitors CI, auto-merges if clean
```

### Branch topology

```
main ──────────────────────────────────────────────▶
  │                                        ▲  ▲
  ├── feature/auth (ship-a) ──────────────┘  │
  ├── feature/ratelimiter (ship-b) ──────────┘
  │
fleet/state (orphan, never merged)
  └── FLEET.md only
```

---

## Configuration

`.fleet/config.yml` validated by Zod schema:

```yaml
commander:
  model: claude-opus-4-5
  poll_interval_minutes: 5

execution:
  strategy: mapreduce          # sequential | mapreduce
  stall_threshold_min: 30
  unresponsive_threshold_min: 10
  shadow_dispatch: false
  shadow_delay_min: 15

heartbeat:
  interval_seconds: 60

merge:
  ci_required: true
  auto_rebase: true

brief:
  mode: static                 # static | llm

ships:
  - id: ship-a
    adapter: claude
```

---

## Adapter interface

Any coding agent integrates via the `FleetAdapter` interface:

```typescript
interface FleetAdapter {
  name: string;
  start(mission: MissionBrief, context: FleetContext): Promise<AgentSession>;
  isAlive(session: AgentSession): Promise<boolean>;
  send(session: AgentSession, message: string): Promise<void>;
  stop(session: AgentSession): Promise<void>;
}
```

Currently shipped: Claude Code, Codex, Aider, OpenCode, Gemini CLI, Cursor CLI, Amp CLI, and A2A adapters.

---

## Testing strategy

| Layer | Framework | Count | What it covers |
|-------|-----------|-------|----------------|
| Unit | Vitest | 70+ | Parsers, state machine, DAG, config, heartbeat, adapters |
| Integration | Vitest | 5+ | Real git repos, branch operations, protocol round-trips |
| E2E (mock) | Vitest | v0.2 | Full lifecycle with mocked adapter and gh CLI |
| E2E (real) | Bash script | v0.2 | Real Claude Code session against test repo |

---

## Design principles

1. **Git is the only bus** — no SSH, no shared filesystem, no websockets. If it can push to GitHub, it can join the fleet.
2. **Markdown is the protocol** — human-readable, diffable, debuggable with `cat`.
3. **State machine as law** — all transitions validated. Invalid moves throw errors.
4. **Optimistic concurrency** — no locks. Push retries with rebase on conflict.
5. **Heartbeat-based liveness** — no explicit health messages. Commander infers health from push timestamps.
6. **Commander is replaceable** — full state lives in git. Any machine can resume command.
