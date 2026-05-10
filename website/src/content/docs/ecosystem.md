---
title: Ecosystem
description: Plugins, integrations, and governance layers that extend FleetSpark.
---

FleetSpark ships the execution layer — parallel missions, multi-agent coordination, git-based state, and auto-merge. The ecosystem extends it with governance, tooling, and integrations.

## Governance

### drsti-dev-flow

**[@drsti/dev-flow](https://github.com/drsti-ai/dev-flow)** — A governance layer for AI-assisted development. Adds maturity levels, workstream tracking, review gates, and pre-proposal coordination checks to any project.

**What it adds:**

| Capability | Description |
|------------|-------------|
| Maturity levels (L1–L4) | Right-size the process to the risk — from a single-line fix to full spec/plan/code review gates |
| Workstream state | Durable state in JSON files that survives session compaction and agent handoffs |
| Pre-proposal coordination | Checks for file-level scope conflicts before new work starts |
| Level 4 review gates | Structured spec → plan → code pipeline with self-review and peer-review at each step |
| Two-loop guardrail | Hard gate: the same root-cause recurring after two fix cycles requires a foundation spec, not another patch |

**Who it's for:**

- Solo developers who want structured AI-assisted workflows without overhead
- Teams running regulated or quality-critical work (auth, billing, data migrations)
- Projects where context must survive across multiple AI sessions

**Current status:** Available now as a standalone governance layer. FleetSpark plugin integration (enforcement hooks) is planned for v1.5 — see below.

**Get started (standalone):**

```bash
# Copy the adapter template to your project
cp drsti-dev-flow/templates/adapter.yml .drsti/adapter.yml

# Use the Fleet mission template
fleet command --template drsti-dev-flow
```

---

## `@drsti/dev-flow` plugin — how it works (v1.5)

The v1.1 `drsti-dev-flow` mission template gives agents *instructions* — write a spec, self-review, update the workstream file. The v1.5 plugin makes those instructions *enforceable* by hooking into FleetSpark's execution pipeline.

### The difference: instructions vs. enforcement

| | v1.1 template | v1.5 plugin |
|--|---------------|-------------|
| Spec exists before impl starts | Agent is asked to check | **Fleet blocks M2 if spec artifact is missing** |
| Review gate before merge | Agent is asked to update state | **Fleet blocks PR if `merge_gate ≠ "ready"`** |
| File conflict with other workstream | Agent is asked to check | **Fleet blocks mission start if overlap detected** |
| L4 peer review required | Agent is asked to get review | **Fleet refuses to merge until all gate fields are populated** |

### Plugin loader API

FleetSpark v1.5 exposes a plugin interface that npm packages implement:

```typescript
interface FleetPlugin {
  name: string;
  version: string;

  // Runs before an agent starts a mission — return block: true to prevent start
  onBeforeMissionStart?(
    mission: Mission,
    context: FleetContext
  ): Promise<{ block: boolean; reason?: string }>;

  // Runs before Fleet creates a merge PR — return block: true to prevent merge
  onBeforeMerge?(
    mission: Mission,
    pr: PullRequest
  ): Promise<{ block: boolean; reason?: string }>;

  // Extend the CLI with new subcommands
  registerCLISubcommands?(): CLISubcommand[];

  // Extend the FLEET.md manifest with custom fields
  registerManifestExtensions?(): ManifestExtension[];
}
```

Install the plugin once, and it applies to every fleet run in that project:

```bash
fleetspark plugin install @drsti/dev-flow
```

### What the plugin enforces

**Before M2 (implement) starts — `onBeforeMissionStart`:**

1. Reads `workstreams.json` → finds the workstream for this mission
2. Checks `review_gate.spec.artifact` is set (spec was committed)
3. Checks `review_gate.spec.self_review` is set (agent self-reviewed)
4. For L4 workstreams: also checks `review_gate.spec.peer_review` is set
5. Runs the pre-proposal coordination check — scans all active workstreams for `claim_files` overlap
6. **Blocks the mission** if any check fails, with a specific reason message

**Before any branch merges — `onBeforeMerge`:**

1. Finds the workstream associated with this mission's branch
2. Checks `merge_gate === "ready"`
3. For L4: verifies all three phases (spec/plan/code) each have `artifact + self_review + peer_review`
4. **Blocks the PR** until the workstream state file is updated

**ConflictDetector escalation:**

FleetSpark's existing `ConflictDetector` warns when two branches touch the same files. The plugin escalates severity based on maturity level:

```
L1–L2 + file overlap  →  warning in PR body (proceed)
L3 + file overlap     →  prominent warning (proceed)
L4 + file overlap     →  hard blocker (PR blocked until resolved)
```

**New CLI subcommands:**

```bash
fleet drsti status            # all workstreams + gate completion at a glance
fleet drsti gate --ws ws-id   # which gates are open/closed for a workstream
fleet drsti claim --ws ws-id --files src/auth.ts   # register file ownership
```

### End-to-end flow

```
fleet command --template drsti-dev-flow
   │
   ├── Fleet creates M1 (spec), M2 (impl), M3 (review) branches
   │
   ▼
Ship starts M1 — agent writes spec, updates workstreams.json, self-reviews
   │
M1 branch ready → onBeforeMerge hook
   └── Plugin: spec.artifact ✓  merge_gate = "ready" ✓  → PR created → merged
   │
Plugin unblocks M2 → onBeforeMissionStart hook
   └── Plugin: spec gate complete ✓  no file conflicts ✓  → agent starts
   │
Ship works on M2 — agent implements, self-reviews, sets merge_gate = "ready"
   │
M2 branch ready → onBeforeMerge hook
   └── Plugin: code.artifact ✓  merge_gate = "ready" ✓  → PR created → merged
   │
Plugin unblocks M3 → peer-review mission runs
```

### Relationship to FleetSpark core

FleetSpark exposes the plugin loader API and the hook surface. It does not implement any governance logic. The plugin is entirely owned and maintained by the drsti-dev-flow project — FleetSpark is the runtime, not the opinion.

- **FleetSpark** answers *"how do we run multiple agents in parallel?"*
- **drsti-dev-flow** answers *"how do we ensure quality before and after each mission?"*

A solo developer with one machine is a valid drsti-dev-flow user without FleetSpark. A team running Fleet missions can layer the plugin on top for enforcement.

---

## Plugin API (v1.5, open for design input)

If you're building a plugin and want to be involved in the API design — hook surface, manifest extensions, event subscriptions — open an issue on the [FleetSpark repository](https://github.com/fleetSpark/fleet) tagged `plugin-api`.

drsti-dev-flow will be the reference implementation: the plugin API will be designed around what it needs to enforce, then opened to the community.

---

## Adapters

FleetSpark ships 8 built-in coding agent adapters. See [Adapters](/adapters/) for the full list and how to write your own.

---

## Community

- **GitHub Discussions** — [github.com/fleetSpark/fleet/discussions](https://github.com/fleetSpark/fleet/discussions)
- **Issues** — bug reports and feature requests
- **Contributing** — see the [Contributing guide](/contributing/) to add an adapter or improve the core
