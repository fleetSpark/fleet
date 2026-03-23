# Fleet Roadmap

> Living document. Updated as milestones ship.

---

## v0.1 — Core CLI (shipped)

The protocol, core library, Claude adapter, and essential CLI commands.

- [x] Protocol spec v1.0 (FLEET.md, MISSION.md, task_brief.json)
- [x] Protocol amendment: FLEET.md on `fleet/state` branch (not main)
- [x] Monorepo scaffold (npm workspaces: @fleet/core, fleet-cli, @fleet/adapter-claude)
- [x] Protocol types and interfaces
- [x] FLEET.md parser/writer with round-trip fidelity
- [x] MISSION.md parser/writer
- [x] Mission state machine (10 states, validated transitions)
- [x] DAG scheduler with cycle detection
- [x] Config schema (.fleet/config.yml) with Zod validation
- [x] Config loader with sensible defaults
- [x] Git operations (clone, branch, read, write, push with retry)
- [x] Ship heartbeat timer (push MISSION.md on interval)
- [x] Commander monitor (alive/stale/dead thresholds)
- [x] Claude Code adapter (spawn, track, stop)
- [x] `fleet init` — scaffold .fleet/config.yml + fleet/state branch
- [x] `fleet status` — mission board display, `--watch` mode
- [x] `fleet command --plan-file` — load YAML plan, create missions/branches
- [x] `fleet command --plan` — LLM decomposition via @anthropic-ai/sdk
- [x] `fleet command --resume` — claim commander, start monitor loop
- [x] `fleet ship --join` — clone, auto-assign, start heartbeat + adapter
- [x] `fleet assign` — manual mission-to-ship assignment
- [x] CI workflow (Node 18/20/22)
- [x] 70 unit tests + 5 integration tests

---

## v0.2 — Usable end-to-end (shipped)

Close the gaps that prevent Fleet from running a real mission without manual intervention.

- [x] `fleet brief --generate` — generate FLEET_CONTEXT.md from codebase analysis (static + LLM modes)
- [x] `fleet logs <ship>` — tail a ship's MISSION.md from its branch (one-shot + `--follow`)
- [x] Merge commander — watch completed missions, create PRs, check CI, auto-merge
- [x] `fleet command --handoff` — graceful commander transfer (implicit, any machine resumes)
- [x] End-to-end smoke test — mock-based in CI + manual real-agent script
- [x] npm publish workflow — automated on `v*` tag push (scoped @fleet packages)
- [x] State machine: `reject` event for CI failure recovery (`merge-queued → in-progress`)
- [x] GitOps: PR lifecycle methods (`createPR`, `getPRStatus`, `mergePR`, `fetchBranch`)
- [x] 101 tests (26 new: 8 merge commander + 4 brief generator + 4 git PR + 3 logs + 3 handoff + 2 monitor + 1 E2E + 1 config)

---

## v0.5 — Multi-agent + Spark

Support for additional coding agents and the full Spark execution model.

- [ ] Codex adapter (`@fleet/codex`)
- [ ] Aider adapter (`@fleet/aider`)
- [ ] Shadow dispatch — stalled ship triggers parallel execution on spare machine
- [ ] Fleet brief injection into agent system prompts
- [ ] Conflict detection before merge (cross-branch file overlap)
- [ ] `fleet status --json` — machine-readable output

---

## v1.0 — Production-ready

- [ ] OpenCode adapter (`@fleet/opencode`)
- [ ] A2A protocol adapter (`@fleet/a2a`)
- [ ] Slack/webhook notifications for merge events
- [ ] Commander election protocol (multi-commander failover)
- [ ] Ship resource limits and concurrency caps
- [ ] Telemetry dashboard (mission throughput, ship utilization)
- [ ] Documentation site live

---

## Backlog (unscheduled)

Features mentioned in docs or design discussions, not yet assigned to a milestone.

- [ ] `fleet replay <mission-id>` — re-run a failed mission
- [ ] Ship health scoring (success rate, avg completion time)
- [ ] Mission templates (reusable task patterns)
- [ ] Git provider abstraction (GitLab, Bitbucket support)
- [ ] Remote ship mode (EC2/cloud VM auto-provisioning)
- [ ] Interactive mission board (TUI with blessed/ink)
