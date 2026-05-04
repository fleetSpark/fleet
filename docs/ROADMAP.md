# Fleet Product Roadmap (PRD Extension)

This document extends the v1 PRD with a forward roadmap for how Fleet can evolve from a solo orchestration tool into a broader software execution system.

## Baseline (Today)

Fleet v1 focuses on:

- Solo developer workflows across personal machines
- Git-native coordination via `FLEET.md` + `MISSION.md`
- Commander planning/dispatch, ship execution, heartbeat monitoring
- Spark-inspired execution (`sequential`, `mapreduce`, `spark`)

## North Star

**Make software execution predictable, measurable, and continuously improving across agents, machines, and workflows.**

---

## Strategic Pillars

### 1) Outcome Optimization Engine

Move beyond static orchestration and optimize for:

- Lead time to merged PR
- Cost per completed mission
- Quality signals (CI pass rate, rework/rollback rate)

Planned capabilities:

- Mission scoring model (time, cost, quality)
- Auto strategy selection (`sequential`/`mapreduce`/`spark`) by mission profile
- Dynamic shadow dispatch based on stall probability instead of fixed thresholds

### 2) Persistent Fleet Memory

Turn one-off runs into a compounding system:

- Historical mission memory (patterns that worked/failed)
- Repo-specific playbooks and templates
- Reusable unblock guidance and known-fix library

Planned capabilities:

- `FLEET_CONTEXT.md` generation informed by prior runs
- Mission template library (feature, refactor, docs, dependency updates)
- Suggested task decomposition based on repository history

### 3) Team Lite Collaboration

Expand from solo developers to small engineering teams without heavy infrastructure:

- Shared commander visibility
- Reviewer routing and explicit ownership lanes
- Lightweight approval rules and handoff workflows

Planned capabilities:

- Team mission board with ownership metadata
- Role-aware merge approval policies
- Human-in-the-loop escalation paths for blocked/failed missions

### 4) Adapter Ecosystem Platform

Strengthen the adapter model as a defensible platform layer:

- Public adapter registry
- Compatibility/capability matrix
- Quality/security certification tracks

Planned capabilities:

- Adapter validation suite and certification badges
- Standardized adapter metadata schema
- Community submission workflow and discoverability

### 5) Governance and Trust Layer

Enable broader usage with stronger controls and auditability:

- Policy guardrails for sensitive files and operations
- Merge governance beyond basic CI checks
- End-to-end mission audit timeline

Planned capabilities:

- Path-level write protections and mission constraints
- Configurable policy checks in merge queue progression
- Structured event logs for mission lifecycle analysis

---

## Phased Delivery Plan

### Phase A (0-3 months): Instrumentation + Adaptive Execution

Goals:

- Add core telemetry for mission time, retries, and quality outcomes
- Introduce recommendation engine for execution strategy selection

Success metrics:

- 20% reduction in median mission cycle time
- 15% reduction in stalled mission rate

### Phase B (3-6 months): Persistent Memory + Templates

Goals:

- Launch repository memory and mission template packs
- Improve initial task decomposition quality with historical context

Success metrics:

- 25% reduction in first-attempt mission failures
- 30% reduction in commander interventions per run

### Phase C (6-9 months): Team Lite

Goals:

- Support 2-10 person teams with ownership and approval workflows
- Preserve zero-infra/Git-native operating model

Success metrics:

- 40% of active fleets using shared ownership metadata
- 90% of blocked missions escalated within SLA

### Phase D (9-12 months): Ecosystem + Governance

Goals:

- Launch adapter registry/certification
- Ship policy engine and mission audit timeline

Success metrics:

- 10+ certified adapters
- 99% auditable mission events for completed runs

---

## Risks and Mitigations

- **Risk: Product complexity grows faster than usability.**
  - Mitigation: Keep simple defaults and progressive disclosure in CLI/config.
- **Risk: Team features dilute solo-developer fit.**
  - Mitigation: Preserve solo-first UX; make team features opt-in.
- **Risk: Metrics incentives harm code quality.**
  - Mitigation: Balance time/cost metrics with quality and rollback signals.
- **Risk: Adapter ecosystem quality variance.**
  - Mitigation: Certification, test harnesses, and transparent capability scoring.

## Open Questions

- What minimum event model is required for reliable mission analytics?
- Which governance controls should be protocol-level vs. implementation-level?
- Should Team Lite be represented in `FLEET.md` directly or via an optional companion spec?
- What is the best incentive model for third-party adapter maintainers?
