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

## v0.5 — Multi-agent + Spark-Inspired Execution (shipped)

Support for additional coding agents and the core Spark-inspired execution model.

- [x] Adapter registry — dynamic resolution of adapters by name (`resolveAdapter`)
- [x] Codex adapter (`@fleetspark/adapter-codex`) — spawns `codex --full-auto --quiet`
- [x] Aider adapter (`@fleetspark/adapter-aider`) — spawns `aider --yes-always --no-git --message`
- [x] Ship command uses adapter registry + Fleet brief injection (`FLEET_CONTEXT.md`)
- [x] GitOps: `diffNameOnly` method for cross-branch file comparison
- [x] Conflict detection before merge (cross-branch file overlap via `ConflictDetector`)
- [x] Conflict warnings integrated into MergeCommander PR body
- [x] Shadow-dispatch detection — stale missions are marked for duplicate execution after configurable delay
- [x] `fleet status --json` — machine-readable output
- [x] 116 tests across 24 test files (15 new)

---

## v1.0 — Production-ready (shipped)

Full multi-agent support, production hardening, and documentation.

- [x] OpenCode adapter (`@fleetspark/adapter-opencode`) — spawns `opencode --non-interactive`
- [x] A2A protocol adapter (`@fleetspark/adapter-a2a`) — JSON-RPC A2A protocol client
- [x] Gemini CLI adapter (`@fleetspark/adapter-gemini`)
- [x] Cursor CLI adapter (`@fleetspark/adapter-cursor`)
- [x] Amp CLI adapter (`@fleetspark/adapter-amp`)
- [x] Slack/webhook notifications — Notifier with JSON + Slack formatting, event filtering
- [x] Commander election protocol — optimistic locking via git push races, heartbeat, graceful release
- [x] Resource manager primitives — per-ship/global limits and mission timeout detection library
- [x] Telemetry dashboard — TelemetryCollector with mission counts, ship utilization, throughput metrics
- [x] Documentation site — Astro Starlight with architecture, adapters, CLI reference, configuration docs
- [x] Interactive TUI dashboard (`fleet dashboard` — Ink/React)
- [x] Web dashboard — browser-based fleet monitoring with mobile support
- [x] npm publish — `npx fleetspark` available on npm registry
- [x] 230+ tests across 44 test files

---

## v1.1 — Growth & Onboarding (in progress)

Remove friction at every stage of the user journey.

- [x] `fleet demo` — zero-friction simulated fleet run (no repo, no agents, no network)
- [x] Mission templates — 5 built-in reusable plans (`--template test-coverage|security-audit|api-docs|dependency-update|refactor`)
- [x] `fleet report` — post-run markdown summary with timing, merge status, time-saved estimate
- [x] GitHub Action (`fleetspark/fleet-action`) — run fleet operations in CI workflows
- [x] **`drsti-dev-flow` mission template** — governed-development mission template (`--template drsti-dev-flow`) that adds a maturity-level workstream schema, pre-proposal conflict checks, L4 review gates (spec → plan → code with writer/reviewer split), 2-loop guardrail, and recommended model/effort routing per phase. Sits on top of FleetSpark's existing `ConflictDetector`, `FleetAdapter` registry, and `FLEET_CONTEXT.md` broadcast — no new core primitives required. Authored and maintained by the `drsti-dev-flow` project (see [drsti-flow.dev](https://drsti-flow.dev) when published)
- [x] **Configurable `merge.target_branch`** — repos with non-`main` integration branches (long-lived feature branches, `develop`, `release/*`) can now point Fleet at a custom merge target without forking. `merge-commander` PR creation and `conflict-detector` diff base both honor the config; defaults to `main` so existing fleets are unaffected.

---

## v1.5 — Ecosystem (planned)

Expand FleetSpark beyond the CLI into developer workflows and cloud infrastructure.

- [ ] VS Code extension — sidebar mission board, ship health, command palette integration
- [x] Agent performance benchmarks — per-agent success rate, avg duration, best-fit tracking (`computeBenchmarks`/`renderBenchmarks` in core; `fleet benchmarks [--json]`)
- [ ] Cloud ship provisioning — `fleet ship --spawn aws|fly` auto-provisions VMs
- [x] Full spare-ship shadow execution — duplicate a stalled mission onto an available ship and accept the first completed result (`ShadowExecutor`: spare-ship selection, isolated shadow branch, first-completed-wins resolution; wired into the commander shadow-dispatch path)
- [x] Discord/Linear/Telegram webhook integrations (`Notifier` gains `discord`/`telegram`/`linear` formats + `chat_id` config + per-provider payloads)
- [x] **Planner integration & autonomous coordination** (5 items — close the coordination loop above mission execution; no protocol change):
  - [x] **`--plan-source <adapter>`** — consume an external planner's validated, conflict-checked batch block (a third plan source alongside `--plan` and `--plan-file`), so a scheduled PM agent feeds missions directly instead of hand-written YAML. `BatchBlock` + `validateBatchBlock` (enforces `approved`/`conflictChecked` + DAG) + `loadBatchBlock` (file or registered `PlanSource`) in core; `fleet command --plan-source <source>` in CLI.
  - [x] **`fleet heartbeat` + machine `mode: mission\|manual`** — non-mission liveness publisher so a commander, an idle box, or a manually-driven agent session shows alive without running `fleet ship`. `LivenessPublisher` writes `presence/<host>.json` to `fleet/state`; `machine.mode` config + `fleet heartbeat [--mode] [--once]` CLI; `isPresenceAlive` reader for dashboards.
  - [x] **`fleet report --live`** + web-dashboard risk panel — continuous health/risk view (CI-failure trends, aging/stalled missions, idle-ship-while-queue-nonempty, blocked dependency chains, stale-unapproved batches). `analyzeRisk`/`renderRiskPanel` in core; `fleet report --live`; `/api/risk` endpoint in web-dashboard.
  - [x] **`fleet outcomes`** — mission-outcome event stream (the merge commander already classifies every terminal state) so a planner can detect failed/stalled batches and, gated behind a clean-run ramp (`summary.cleanRun`), advance toward auto-assign. `classifyOutcomes`/`generateOutcomesJson` in core; `fleet outcomes [--json] [--watch]` CLI.
  - [x] **Action-item ingestion adapter** — opt-in planner-side adapter that scans reviews/chat/commits and *proposes* backlog items (never auto-dispatches). `ingestActionItems`/`ingestFromAdapters` + `ActionItemAdapter` interface in core.
- [x] **`@drsti/dev-flow` plugin** — governance plugin (`fleetspark plugin install @fleetspark/plugin-drsti-dev-flow`). Plugin loader API in core (`FleetPlugin` interface, `PluginLoader`), `onBeforeMissionStart` and `onBeforeMerge` hooks, `fleet plugin install/list` CLI commands, full gate enforcement for L3/L4 workstreams with maturity-level escalation. 22 unit tests.
- [x] **`fleet run`** — single-machine sequential mission runner (`fleet run --template <name>`). Topological sort of missions by dependency, plugin gate enforcement with interactive retry loop, per-adapter spawn + poll, branch summary on completion. Works with any template including `drsti-dev-flow`. 7 unit tests.

---

## v2.0 — Platform (planned)

Transform FleetSpark from a CLI tool into a collaborative development platform.

- [ ] Fleet for Teams — shared mission board with invite links, multi-developer coordination
- [ ] Fleet Cloud SaaS — hosted commander + cloud ships, usage-based pricing
- [ ] `fleet replay <mission-id>` — re-run a failed mission
- [ ] Git provider abstraction (GitLab, Bitbucket support)
- [ ] Mission marketplace — community-contributed templates
