# FleetSpark v2.0 Growth Phase — Spec & Roadmap

> **For agentic workers:** This is the strategic spec. For implementation details, see the phase-specific plans.

**Goal:** Transform FleetSpark from a shipped v1.0 CLI tool to a growth-ready product with zero-friction onboarding, CI integration, reusable templates, and post-run reporting.

**Architecture:** All new features follow existing conventions — Commander.js commands in `packages/cli/src/commands/`, core logic in `packages/core/src/`, Vitest tests in `tests/`, ESM with `.js` imports. No new infrastructure dependencies.

**Tech Stack:** TypeScript 5.x, Node.js 18+, Commander.js, Vitest, npm workspaces

---

## Strategic Vision

FleetSpark v1.0 is technically complete. The gap is **adoption**. These features remove friction at every stage of the user journey:

| Stage | Friction | Solution |
|---|---|---|
| **Discovery** | "What does this do?" | `fleet demo` — see it work in 30 seconds |
| **Setup** | "I need multiple machines" | GitHub Action — CI gives you the machines |
| **Planning** | "What do I tell it?" | Mission templates — pick a preset |
| **Results** | "What happened?" | `fleet report` — shareable summary |

---

## Phase Overview

### P0 — Critical Fixes (v1.0.3)
- ~~Fix fresh-repo init bug~~ (already fixed)
- `fleet demo` — simulated fleet run with mock ships

### P1 — Growth Features (v1.1)
- GitHub Action (`fleetspark/fleet-action`)
- Mission templates (5 built-in)
- `fleet report` — post-run markdown summary

### P2 — Ecosystem (v1.5) — *planned separately*
- VS Code extension
- Agent performance benchmarks
- Cloud ship provisioning

### P3 — Platform (v2.0) — *planned separately*
- Fleet for Teams
- Fleet Cloud SaaS

---

## Feature Specs

### 1. `fleet demo` (P0)

**What:** A self-contained demo that simulates a complete fleet run — planning, ship assignment, progress, merge, report — entirely on the local machine with mock data. No git repo, no agents, no network.

**Why:** Every successful dev tool has a zero-friction demo. Users need to SEE Fleet work before committing to setup.

**User experience:**
```
$ npx fleetspark demo

⚡ Fleet Demo — simulating a 4-mission fleet run...

Planning: "Add OAuth, rate limiter, API docs, unit tests"
  ✓ M1: feature/oauth        → Ship-Alpha (claude-code)
  ✓ M2: feature/rate-limiter → Ship-Beta (codex)
  ✓ M3: feature/api-docs     → Ship-Gamma (aider)
  ✓ M4: feature/unit-tests   → Ship-Delta (gemini) [depends: M1]

Running... (simulated)
  [00:03] M2 completed ✓ — PR #43 auto-merged
  [00:05] M3 completed ✓ — PR #44 auto-merged
  [00:08] M1 completed ✓ — PR #42 auto-merged
  [00:08] M4 unblocked → Ship-Delta starting...
  [00:12] M4 completed ✓ — PR #45 auto-merged

All missions complete! 4/4 merged in 12s (simulated).

Ready to try it for real?
  npx fleetspark init
  npx fleetspark command --plan "your goal here"
```

**Technical design:**
- New file: `packages/cli/src/commands/demo.ts`
- Pure console output with `setTimeout` delays to simulate progress
- No git operations, no network, no file I/O beyond stdout
- Registered in `packages/cli/src/index.ts`
- Test: verify demo runs without error and outputs expected strings

---

### 2. Mission Templates (P1)

**What:** Built-in mission plan templates that users invoke with `fleet command --template <name>`. Each template is a pre-defined YAML plan with sensible mission decomposition.

**Why:** Writing good `--plan` goals requires LLM access (API key). Templates let users start immediately without setup.

**Templates (5 built-in):**

| Name | Missions | Description |
|---|---|---|
| `test-coverage` | 4 | Add unit tests for untested modules |
| `security-audit` | 3 | OWASP checks, dependency audit, secret scanning |
| `api-docs` | 3 | OpenAPI spec, endpoint docs, usage examples |
| `dependency-update` | 3 | Update deps, fix breaking changes, verify CI |
| `refactor` | 4 | Extract shared code, simplify complex functions, remove dead code, add types |

**User experience:**
```
$ fleet command --template test-coverage
Using template: test-coverage (4 missions)
Commander running. 4 missions created.
```

**Technical design:**
- New file: `packages/core/src/templates/templates.ts` — template definitions
- New file: `packages/core/src/templates/index.ts` — template registry + list
- Modify: `packages/cli/src/commands/command.ts` — add `--template <name>` option
- Templates are plain TypeScript objects matching the existing `planData.missions` format
- `fleet command --template list` shows available templates
- Export from `packages/core/src/index.ts`

---

### 3. `fleet report` (P1)

**What:** Generates a markdown summary of the current or most recent fleet run — mission outcomes, timing, merge status, and a "time saved" estimate.

**Why:** Shareable proof of value. Users post reports → organic marketing. Also useful for post-mortems.

**User experience:**
```
$ fleet report

# Fleet Run Report
Generated: 2026-04-22T10:30:00Z

## Summary
| Metric | Value |
|---|---|
| Total missions | 4 |
| Completed | 4 |
| Failed | 0 |
| Ships used | 3 |
| Total time | 23 min |
| Est. sequential time | 1h 32min |
| **Time saved** | **~69 min (75%)** |

## Missions
| ID | Branch | Ship | Agent | Status | Duration |
|---|---|---|---|---|---|
| M1 | feature/oauth | ship-laptop | claude-code | ✅ merged | 8 min |
| M2 | feature/rate-limiter | ship-desktop | codex | ✅ merged | 12 min |
| M3 | feature/api-docs | ship-ec2 | aider | ✅ merged | 6 min |
| M4 | feature/unit-tests | ship-laptop | claude-code | ✅ merged | 5 min |

## Merge Queue
All PRs merged successfully. No conflicts detected.

---
*Generated by [FleetSpark](https://fleetspark.dev)*
```

**Technical design:**
- New file: `packages/core/src/report/report-generator.ts` — generates report from FleetManifest
- New file: `packages/cli/src/commands/report.ts` — CLI command
- Options: `--json` for machine-readable, `--output <file>` to write to file
- Reads FLEET.md from `fleet/state` branch, formats as markdown
- Time estimation: assume sequential would take N * avg_duration; parallel took max(merge_dates) - min(start_date)
- Register in `packages/cli/src/index.ts`

---

### 4. GitHub Action (P1)

**What:** A reusable GitHub Action (`fleetspark/fleet-action`) that runs fleet operations in CI workflows.

**Why:** Removes the "I need multiple machines" barrier. GitHub-hosted runners become ships.

**User experience (in their repo):**
```yaml
# .github/workflows/fleet.yml
name: Fleet Run
on:
  workflow_dispatch:
    inputs:
      plan:
        description: 'Goal to decompose into missions'
        required: true

jobs:
  fleet-plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: fleetspark/fleet-action@v1
        with:
          command: plan
          plan: ${{ github.event.inputs.plan }}

  fleet-ship:
    needs: fleet-plan
    runs-on: ubuntu-latest
    strategy:
      matrix:
        ship: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - uses: fleetspark/fleet-action@v1
        with:
          command: ship
          agent: claude-code
```

**Technical design:**
- New directory: `action/` at repo root
- Files: `action/action.yml` (GitHub Action metadata), `action/index.js` (entry point)
- The action installs `fleetspark` via npm, then runs the appropriate CLI command
- Inputs: `command` (init|plan|ship|status|report), `plan`, `agent`, `template`
- Supports both `plan` and `ship` modes
- Separate plan from this sprint — implement as a thin wrapper calling CLI

---

## Updated ROADMAP.md

The roadmap should be updated to reflect: v1.0 shipped, backlog items completed, and the new phased growth plan.
