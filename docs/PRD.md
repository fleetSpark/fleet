# Fleet — Product Requirements Document v1.0

> **Steroids for AI coding.**  
> One developer. Every machine they own. All running agents in parallel.  
> A commander coordinates, recovers failures, merges work — while you sleep.

---

## 1. What Fleet Is

Fleet is steroids for AI coding. One developer. Every machine they own — laptop, desktop, spare EC2, a friend's server — all running coding agents in parallel on the same codebase. A commander node plans the work, dispatches missions to each ship, recovers from failures, and merges completed branches while the developer sleeps.

Fleet works with any coding agent: Claude Code, OpenAI Codex, Aider, OpenCode, or anything A2A-compatible. Workers join the fleet with one command. No SSH. No IP configuration. No shared filesystem. GitHub is the message bus.

**Fleet is not an agent. It does not write code. It coordinates agents that do.**

The founding insight: every AI coding tool today assumes one developer, one machine, one session. Fleet answers the question none of them answer: what if you have three machines and want all of them working on your project right now?

---

## 2. The Problem

### 2.1 One machine, one context, one bottleneck
A Claude Code session fills its context window in 30-60 minutes on a large codebase. Every other machine sits idle. The problem is not that Claude Code is slow — only one machine is running.

### 2.2 Coordination overhead kills parallel work
Running three sessions manually means constant context switching with no shared state. Every coordination decision falls on the human.

### 2.3 Failures have no recovery loop
When an agent stalls, the developer has to notice it, diagnose it, and restart it manually. Across three machines this is a full-time job.

### 2.4 Work stops when the developer stops
Every existing AI coding tool requires an active human session. Close the laptop: work stops. Fleet makes those 8 idle hours productive.

---

## 3. Solution — Four Primitives

| Primitive | What it does | File / interface |
|-----------|-------------|-----------------|
| FLEET.md | Fleet manifest — active missions, ships, merge queue | Git file on main branch |
| MISSION.md | Per-ship mission log — task, steps, blockers, heartbeat | Git file on each ship's branch |
| Commander | Plans, dispatches, monitors, merges — global view only | `fleet command` |
| Ship adapters | Thin wrappers making Claude Code, Codex, Aider A2A-compatible | `@fleet/claude` · `@fleet/codex` · `@fleet/aider` |

### 3.1 How a Fleet run works

1. `fleet command --plan 'Add OAuth login, fix rate limiter, update docs'`
2. Commander decomposes into missions with dependencies, assigns each to a ship
3. Each ship: git clone/checkout → pull MISSION.md → start agent → execute
4. Ships push MISSION.md every 60 seconds as heartbeat
5. Commander detects completions, unblocks dependencies, queues merges
6. Merge commander: diff, conflict scan, CI gate, rebase, PR draft
7. Developer wakes up to PRs waiting for approval — Fleet never merges without human sign-off

---

## 4. Target User

> *It's 11pm. Laptop is running Claude Code on feature/oauth. Desktop is idle. EC2 from last sprint is still running. You want all three working on your project tonight — not by manually SSHing into each one. One command. Everything starts. Things get done while you sleep.*

Fleet is purpose-built for the solo developer who treats their personal machines as a compute cluster. Not for enterprise teams, compliance environments, or multi-tenant SaaS.

---

## 5. CLI Commands

| Command | What it does |
|---------|-------------|
| `fleet init` | Create `FLEET.md` and `.fleet/config.yml` in your repo |
| `fleet command --plan <goal>` | Decompose goal into mission DAG, assign ships, start orchestration |
| `fleet command --resume` | Resume commander role from `FLEET.md` on any machine |
| `fleet command --handoff` | Gracefully transfer commander role |
| `fleet ship --join <repo>` | Join fleet as a ship: clone, read assignment, start agent |
| `fleet brief --generate` | Generate `FLEET_CONTEXT.md` — broadcast codebase summary to all ships |
| `fleet status` | Print current mission board (`--watch` for live) |
| `fleet merge <branch>` | Trigger merge pipeline |
| `fleet logs <ship>` | Tail `MISSION.md` for a ship (`--follow` for live) |
| `fleet assign <mission> <ship>` | Manually reassign a mission |

---

## 6. Protocol

### 6.1 FLEET.md schema

```markdown
# Fleet manifest
Updated: 2026-03-22T14:30Z

## Commander
host: macbook-prabu  |  last_checkin: 2026-03-22T14:29Z  |  status: active
timeout_minutes: 15

## Active missions
| ID | Branch             | Ship   | Agent       | Status      | Depends | Blocker |
|----|--------------------|--------|-------------|-------------|---------|---------|
| M1 | feature/oauth      | ship-a | claude-code | in-progress | none    | none    |
| M2 | feature/ratelimiter| ship-b | codex       | in-progress | none    | none    |
| M3 | feature/docs       | ship-c | aider       | blocked     | M1      | M1 open |

## Merge queue
- M2 feature/ratelimiter — CI green, awaiting human approval

## Completed
- M0 feature/setup merged 2026-03-21
```

### 6.2 MISSION.md schema

```markdown
# Mission log — feature/oauth
Ship: ship-a  |  Agent: claude-code  |  Status: in-progress

## Mission brief
Implement GitHub OAuth flow. Callback at /auth/github/callback.
Use existing session middleware. Tests required.

## Steps
- [x] Read existing auth middleware
- [x] Scaffold OAuth route
- [ ] Implement callback handler
- [ ] Write integration tests

## Blockers
none

## Heartbeat
last_push: 2026-03-22T14:28Z  |  push_interval_seconds: 60
```

### 6.3 FLEET_CONTEXT.md

Generated by `fleet brief --generate`. One Opus call (~$0.15). Every ship pulls it before starting — skipping the 15-30 turn codebase exploration phase.

---

## 7. Distributed Execution

### 7.1 Map-Reduce model
- **Map:** Each ship independently executes its mission on its own branch
- **Reduce:** Commander collects completions, validates, merges to main
- **GitHub is the message bus** — no IP addresses, no SSH tunnels

### 7.2 Joining the fleet

```bash
fleet ship --join git@github.com:org/repo.git
# 1. Clone the repo
# 2. Read FLEET.md for assigned mission
# 3. Checkout the assigned branch
# 4. Start the configured agent adapter
```

### 7.3 Commander election
Any machine can claim commander role via `fleet command --resume`. Full state lives in FLEET.md on git — no data lost when commander goes offline.

### 7.4 Heartbeat config

| Key | Default | Behaviour |
|-----|---------|-----------|
| `heartbeat_interval_seconds` | 60 | How often ship pushes MISSION.md |
| `stall_threshold_minutes` | 30 | No progress → shadow ship dispatched |
| `unresponsive_threshold_minutes` | 10 | No heartbeat → ship flagged dead |
| `commander_poll_minutes` | 5 | How often commander reads all ship states |

---

## 8. Spark Execution Strategies

### 8.1 Parallel DAG dispatch
Every mission with no dependencies starts immediately. Ships fan out simultaneously.

### 8.2 Shadow dispatch
Stalled ship? Commander clones mission to spare ship. First to complete wins, other is cancelled.

### 8.3 Fleet brief
One codebase analysis pass before dispatch. Every ship skips exploration phase.

### 8.4 Modes

| Mode | Parallel | Shadow | Brief | Use when |
|------|----------|--------|-------|----------|
| `sequential` | No | No | No | Debugging |
| `mapreduce` | Yes | No | Optional | Default |
| `spark` | Yes | Yes | Yes | Max speed |

---

## 9. Ship Adapters

```typescript
export interface FleetAdapter {
  name: string;
  start(mission: MissionBrief, context: FleetContext): Promise<AgentSession>;
  isAlive(session: AgentSession): Promise<boolean>;
  send(session: AgentSession, message: string): Promise<void>;
  stop(session: AgentSession): Promise<void>;
}
```

| Adapter | Package | v1 status |
|---------|---------|-----------|
| Claude Code | `@fleet/claude` | v1.0 |
| OpenAI Codex | `@fleet/codex` | v1.0 |
| Aider | `@fleet/aider` | v1.0 |
| OpenCode | `@fleet/opencode` | v1.1 |
| Custom / A2A | `@fleet/a2a` | v1.1 |

---

## 10. Configuration

```yaml
# .fleet/config.yml
commander:
  model: claude-opus-4-5
  poll_interval_minutes: 5
  max_concurrent_ships: 8

execution:
  strategy: spark             # sequential | mapreduce | spark
  stall_threshold_min: 30
  shadow_max_duplicates: 1

merge:
  ci_required: true
  auto_rebase: true
  notify: terminal            # terminal | slack

broadcast:
  enabled: true
  context_file: FLEET_CONTEXT.md

ships:
  - id: ship-a
    adapter: claude
    mode: local               # local | remote
```

---

## 11. Technical Architecture

- **Runtime:** Node.js 18+ · TypeScript · npm workspaces monorepo
- **State:** Git only — FLEET.md + MISSION.md (zero infra)
- **Commander LLM:** Anthropic API (BYOK, Opus default)
- **Agent invocation:** Child process (CLI) or HTTP (A2A)
- **CI:** gh CLI + GitHub Actions API (read-only)

```
fleet/
├── packages/
│   ├── core/        # Protocol parser, DAG scheduler, heartbeat monitor
│   ├── cli/         # All CLI commands
│   ├── adapters/
│   │   ├── claude/
│   │   ├── codex/
│   │   └── aider/
│   └── merge/       # Diff, CI gate, rebase, PR creation
├── docs/
│   ├── PRD.md       # This file
│   ├── protocol.md  # Full protocol spec
│   └── adapters.md  # How to write an adapter
└── examples/
    ├── solo-single-machine/
    ├── solo-multi-machine/
    └── overnight-sprint/
```

### Mission state machine

| State | Trigger | Next |
|-------|---------|------|
| pending | Created by plan | ready |
| ready | Dependencies complete | assigned |
| assigned | Commander dispatches | in-progress |
| in-progress | Ship executing | completed · blocked · stalled |
| stalled | No progress past threshold | shadow dispatch |
| completed | Ship marks done | merge-queued |
| merge-queued | Merge commander triggered | merged |
| merged | PR approved | terminal |

---

## 12. Release Plan

| Version | Target | Key deliverables |
|---------|--------|-----------------|
| v0.1 | Week 1-2 | `fleet init`, `fleet status`, `fleet ship --join`, Claude adapter |
| v0.5 | Week 3-4 | Codex adapter, merge commander, Spark mode, **Show HN post** |
| v1.0 | Week 5-6 | Aider adapter, commander failover, examples, **Product Hunt** |
| v1.1 | Month 2-3 | OpenCode adapter, Windows native, hosted commander free tier |

---

## 13. Commercial Model

| Tier | Price | What changes |
|------|-------|-------------|
| Fleet OSS | Free forever | Self-managed. Full protocol. MIT. |
| fleetspark.dev Free | Free | Hosted commander, 3 ships max |
| fleetspark.dev Pro | $19/mo | 5 cloud ships, Spark mode |
| fleetspark.dev Scale | $49/mo | 20 cloud ships, priority execution |

BYOK always. Fleet charges for coordination infrastructure, never for LLM usage.

---

## 14. Competitive Position

| Tool | Multi-machine | Auto planning | Sleep and merge |
|------|--------------|---------------|-----------------|
| Claude Code | No | No | No |
| Codex App | No | No | No |
| GitHub Agent HQ | No | No | No |
| Conductor | No | No | No |
| AI Maestro | Partial | No | No |
| **Fleet** | **Yes** | **Yes** | **Yes** |

---

## 15. Open Questions

1. FLEET.md on main branch or dedicated `fleet/` branch?
2. Commander as daemon vs manual invocation?
3. Web dashboard in v0.5 or v1.0?
4. Auto-PR vs always hold for human approval? (Default: always hold)
5. Ephemeral containers vs persistent VMs for cloud ships?
6. Heartbeat frequency vs git history noise (proposed: 60s push, squash on completion)
7. GitHub Actions runner as commander when all machines are ships?

---

*Fleet v1.0 · MIT · github.com/fleetSpark/fleet · fleetspark.dev*
