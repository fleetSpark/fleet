---
title: Mission Templates
description: Run a fleet instantly with built-in mission templates — no LLM API key required.
---

Mission templates let you start a fleet run with a single command, no LLM decomposition needed. Each template is a pre-defined set of missions that works on any codebase. FleetSpark ships with 6 built-in templates.

## Using a template

```bash
# List all available templates
fleet command --template list

# Start a fleet with a template
fleet command --template test-coverage
```

Fleet creates missions from the template, assigns them to ships, and runs them exactly like a manually planned fleet.

## Built-in templates

### `test-coverage`

Improve test coverage across the project. 4 missions run in parallel.

| Mission | What it does |
|---------|-------------|
| M1 | Audit existing tests — find untested modules and coverage gaps |
| M2 | Write unit tests for core utilities and helper functions |
| M3 | Write integration tests for API routes and service boundaries |
| M4 | Add edge-case and error-path tests for critical paths |

```bash
fleet command --template test-coverage
```

---

### `security-audit`

Run a comprehensive security review. 3 missions.

| Mission | What it does |
|---------|-------------|
| M1 | OWASP Top 10 review — injection, XSS, auth weaknesses, insecure defaults |
| M2 | Dependency audit — flag vulnerable packages, outdated deps, CVE matches |
| M3 | Secret scanning — detect hardcoded credentials, API keys, and tokens |

```bash
fleet command --template security-audit
```

---

### `api-docs`

Generate comprehensive API documentation. 3 missions.

| Mission | What it does |
|---------|-------------|
| M1 | Extract OpenAPI/Swagger spec from routes and controllers |
| M2 | Write endpoint reference docs with parameters, responses, and errors |
| M3 | Add usage examples and code samples for each endpoint |

```bash
fleet command --template api-docs
```

---

### `dependency-update`

Update project dependencies to latest versions. 3 missions.

| Mission | What it does |
|---------|-------------|
| M1 | Update dependencies and resolve breaking API changes |
| M2 | Fix type errors and compatibility issues introduced by updates |
| M3 | Verify CI passes and update lock files |

```bash
fleet command --template dependency-update
```

---

### `refactor`

Improve codebase structure and maintainability. 4 missions.

| Mission | What it does |
|---------|-------------|
| M1 | Extract shared logic into reusable utilities |
| M2 | Simplify complex functions — reduce cyclomatic complexity |
| M3 | Remove dead code, unused exports, and stale comments |
| M4 | Add or improve TypeScript types for public interfaces |

```bash
fleet command --template refactor
```

---

### `drsti-dev-flow`

Governed development workflow: spec, implementation, and peer-review — one mission per phase. Designed for teams using the [drsti-dev-flow](https://github.com/drsti-ai/dev-flow) maturity model but works on any project.

| Mission | What it does |
|---------|-------------|
| M1 (spec) | Read the adapter config and codebase context. Run a pre-proposal coordination check. Write a spec covering scope, contracts, acceptance criteria, and risks. Self-review and commit. |
| M2 (impl) | Read the M1 spec. Implement within declared scope, write or update tests, self-review against the spec. |
| M3 (review) | Peer-review the M2 implementation against the M1 spec — spec compliance, test coverage, scope drift. Record findings and approve only when all blockers are resolved. |

Each brief instructs the agent to rename its branch before starting (e.g. `feature/my-feature-spec`). Run the template once per feature.

```bash
fleet command --template drsti-dev-flow
```

> **Note:** M2 depends on M1, M3 depends on M2 — missions run sequentially, not in parallel. This is intentional: each phase gates the next.

---

## Combining templates with configuration

Templates use the agents and settings already defined in `.fleet/config.yml`. You can adjust the number of ships, agent type, and other settings before running a template:

```yaml
# .fleet/config.yml
ship:
  adapter: claude-code   # all template missions use this agent
commander:
  maxConcurrentMissions: 3
```

## What's coming

The template system is designed to be extensible. In a future release you will be able to:

- Load templates from local YAML files (`--template-file my-template.yml`)
- Install community templates as npm packages
- Publish your own templates to share with your team

For now, all templates are built into the `fleetspark` CLI and work offline.
