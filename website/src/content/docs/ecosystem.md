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
| Maturity levels (L1–L4) | Right-size the process to the risk — from single assistant to full spec/plan/code review gates |
| Workstream state | Durable state in files that survives session compaction and agent handoffs |
| Pre-proposal coordination | Checks for scope conflicts before starting new work |
| Level 4 review gates | Structured spec → plan → code review pipeline with self-review and peer-review at each step |
| Two-loop guardrail | Hard gate: the same root-cause finding recurring after two fix cycles requires a foundation spec, not another patch |

**Who it's for:**

- Solo developers who want structured AI-assisted workflows without overhead
- Teams running regulated or quality-critical work (auth, billing, data migrations)
- Projects where context must survive across multiple AI sessions

**Relationship to FleetSpark:**

drsti-dev-flow and FleetSpark answer different questions and work independently:

- **drsti-dev-flow** answers *"how do we decide what to build and ensure quality?"* — governance before and during a mission
- **FleetSpark** answers *"how do we run multiple agents in parallel?"* — execution across machines

A solo developer with one machine is a valid drsti-dev-flow user without FleetSpark. A team running FleetSpark missions can layer drsti-dev-flow governance on top.

**Current status:** Works as a standalone governance layer for any AI-assisted project (Codex, Claude, Gemini, or human contributors). FleetSpark plugin integration — pre-mission coordination hooks and pre-merge review gate hooks — is planned for FleetSpark v1.5.

**Get started:**

```bash
# Copy the adapter template to your project
cp drsti-dev-flow/templates/adapter.yml .drsti/adapter.yml

# Trigger the workflow from any AI assistant
Use drsti-dev-flow for: <your task>
```

---

## Plugin API (v1.5, planned)

FleetSpark v1.5 will introduce a plugin loader API that lets packages:

- Register pre-mission hooks (run a check before missions are created)
- Register pre-merge hooks (run a gate before MergeCommander opens a PR)
- Extend the `FLEET.md` manifest with custom fields
- Add CLI subcommands (`fleet <plugin>:<command>`)
- Subscribe to notifier events (`mission.assigned`, `mission.completed`, `merge.queued`, etc.)

drsti-dev-flow will be the first plugin built against this API, serving as the reference implementation.

If you're building a plugin and want to be involved in the API design, open an issue on the [FleetSpark repository](https://github.com/fleetSpark/fleet) tagged `plugin-api`.

---

## Adapters

FleetSpark ships 8 built-in coding agent adapters. See [Adapters](/adapters/) for the full list and how to write your own.

---

## Community

- **GitHub Discussions** — [github.com/fleetSpark/fleet/discussions](https://github.com/fleetSpark/fleet/discussions)
- **Issues** — bug reports and feature requests
- **Contributing** — see the [Contributing guide](/contributing/) to add an adapter or improve the core
