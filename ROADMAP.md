# Fleet Roadmap

> Living document. Updated as milestones ship.

---

## v0.1 — Core CLI (shipped)

The protocol, core library, Claude adapter, and essential CLI commands.

- [x] Protocol spec v1.0 (FLEET.md, MISSION.md, task_brief.json)
- [x] Protocol amendment: FLEET.md on `fleet/state` branch (not main)
- [x] Monorepo scaffold (npm workspaces: @fleetspark/core, fleetspark, @fleetspark/adapter-claude)
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

## v0.5 — Multi-agent + Spark (shipped)

Support for additional coding agents and the full Spark execution model.

- [x] Adapter registry — dynamic resolution of adapters by name (`resolveAdapter`)
- [x] Codex adapter (`@fleetspark/adapter-codex`) — spawns `codex --full-auto --quiet`
- [x] Aider adapter (`@fleetspark/adapter-aider`) — spawns `aider --yes-always --no-git --message`
- [x] Ship command uses adapter registry + Fleet brief injection (`FLEET_CONTEXT.md`)
- [x] GitOps: `diffNameOnly` method for cross-branch file comparison
- [x] Conflict detection before merge (cross-branch file overlap via `ConflictDetector`)
- [x] Conflict warnings integrated into MergeCommander PR body
- [x] Shadow dispatch — stalled ship triggers parallel execution after configurable delay
- [x] `fleet status --json` — machine-readable output
- [x] 116 tests across 24 test files (15 new)

---

## v1.0 — Production-ready (shipped)

Full multi-agent support, production hardening, and documentation.

- [x] OpenCode adapter (`@fleetspark/adapter-opencode`) — spawns `opencode --non-interactive`
- [x] A2A protocol adapter (`@fleetspark/adapter-a2a`) — JSON-RPC A2A protocol client
- [x] Slack/webhook notifications — Notifier with JSON + Slack formatting, event filtering
- [x] Commander election protocol — optimistic locking via git push races, heartbeat, graceful release
- [x] Ship resource limits and concurrency caps — per-ship + global limits, mission timeout detection
- [x] Telemetry dashboard — TelemetryCollector with mission counts, ship utilization, throughput metrics
- [x] Documentation site — Astro Starlight with architecture, adapters, CLI reference, configuration docs
- [x] 154 tests across 30 test files (19 new: 13 election + 6 telemetry + 5 notifier + 6 resources + 4 A2A + 4 OpenCode)

---

## Backlog (unscheduled)

Features mentioned in docs or design discussions, not yet assigned to a milestone.

- [x] Interactive mission board (`fleet dashboard` — Ink/React TUI)
- [ ] Web dashboard — browser-based fleet monitoring with mobile support (check progress from your phone while on the road)
- [ ] `fleet replay <mission-id>` — re-run a failed mission
- [ ] Ship health scoring (success rate, avg completion time)
- [ ] Mission templates (reusable task patterns)
- [ ] Git provider abstraction (GitLab, Bitbucket support)
- [ ] Remote ship mode (EC2/cloud VM auto-provisioning)
