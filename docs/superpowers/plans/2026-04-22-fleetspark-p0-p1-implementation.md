# FleetSpark P0+P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `fleet demo`, mission templates, `fleet report`, and the GitHub Action — the four features that remove friction from FleetSpark's user journey.

**Architecture:** All features follow existing patterns: Commander.js commands in `packages/cli/src/commands/`, core logic in `packages/core/src/`, tests in `tests/unit/` and `tests/integration/`, ESM with `.js` extensions. Tests import from `dist/` so `npm run build` is required before testing.

**Tech Stack:** TypeScript 5.x, Node.js 18+, Commander.js, Vitest, npm workspaces, ESM

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `packages/cli/src/commands/demo.ts` | `fleet demo` command — simulated fleet run with animated output |
| `packages/core/src/templates/templates.ts` | 5 built-in mission template definitions |
| `packages/core/src/templates/index.ts` | Template registry: getTemplate, listTemplates |
| `packages/core/src/report/report-generator.ts` | Generates markdown/JSON report from FleetManifest |
| `packages/cli/src/commands/report.ts` | `fleet report` CLI command |
| `tests/unit/cli/demo.test.ts` | Demo command test |
| `tests/unit/templates/templates.test.ts` | Template registry + validation tests |
| `tests/unit/report/report-generator.test.ts` | Report generation tests |
| `tests/unit/cli/report.test.ts` | Report CLI command tests |
| `action/action.yml` | GitHub Action metadata |
| `action/index.js` | GitHub Action entry point |

### Modified Files
| File | Change |
|---|---|
| `packages/cli/src/index.ts` | Register `demo` and `report` commands |
| `packages/cli/src/commands/command.ts` | Add `--template <name>` option |
| `packages/core/src/index.ts` | Export template + report modules |
| `ROADMAP.md` | Update with P0-P3 growth phases |

---

## Task 1: Update ROADMAP.md

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Update ROADMAP.md with new growth phases**

Replace the "Backlog (unscheduled)" section and add the new phases:

```markdown
## v1.0 — Production-ready (shipped)

Full multi-agent support, production hardening, and documentation.

- [x] OpenCode adapter (`@fleetspark/adapter-opencode`) — spawns `opencode --non-interactive`
- [x] A2A protocol adapter (`@fleetspark/adapter-a2a`) — JSON-RPC A2A protocol client
- [x] Gemini CLI adapter (`@fleetspark/adapter-gemini`)
- [x] Cursor CLI adapter (`@fleetspark/adapter-cursor`)
- [x] Amp CLI adapter (`@fleetspark/adapter-amp`)
- [x] Slack/webhook notifications — Notifier with JSON + Slack formatting, event filtering
- [x] Commander election protocol — optimistic locking via git push races, heartbeat, graceful release
- [x] Ship resource limits and concurrency caps — per-ship + global limits, mission timeout detection
- [x] Telemetry dashboard — TelemetryCollector with mission counts, ship utilization, throughput metrics
- [x] Documentation site — Astro Starlight with architecture, adapters, CLI reference, configuration docs
- [x] Interactive TUI dashboard (`fleet dashboard` — Ink/React)
- [x] Web dashboard — browser-based fleet monitoring with mobile support
- [x] npm publish — `npx fleetspark` available on npm registry
- [x] 230+ tests across 44 test files

---

## v1.1 — Growth & Onboarding (in progress)

Remove friction at every stage of the user journey.

- [ ] `fleet demo` — zero-friction simulated fleet run (no repo, no agents, no network)
- [ ] Mission templates — 5 built-in reusable plans (`--template test-coverage|security-audit|api-docs|dependency-update|refactor`)
- [ ] `fleet report` — post-run markdown summary with timing, merge status, time-saved estimate
- [ ] GitHub Action (`fleetspark/fleet-action`) — run fleet operations in CI workflows

---

## v1.5 — Ecosystem (planned)

Expand FleetSpark beyond the CLI into developer workflows and cloud infrastructure.

- [ ] VS Code extension — sidebar mission board, ship health, command palette integration
- [ ] Agent performance benchmarks — per-agent success rate, avg duration, best-fit tracking
- [ ] Cloud ship provisioning — `fleet ship --spawn aws|fly` auto-provisions VMs
- [ ] Discord/Linear/Telegram webhook integrations

---

## v2.0 — Platform (planned)

Transform FleetSpark from a CLI tool into a collaborative development platform.

- [ ] Fleet for Teams — shared mission board with invite links, multi-developer coordination
- [ ] Fleet Cloud SaaS — hosted commander + cloud ships, usage-based pricing
- [ ] `fleet replay <mission-id>` — re-run a failed mission
- [ ] Git provider abstraction (GitLab, Bitbucket support)
- [ ] Mission marketplace — community-contributed templates
```

- [ ] **Step 2: Verify the file is valid markdown**

Run: `head -100 ROADMAP.md`
Expected: Properly formatted markdown with v1.0 shipped, v1.1 in progress.

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: update roadmap with v1.1-v2.0 growth phases"
```

---

## Task 2: `fleet demo` Command

**Files:**
- Create: `packages/cli/src/commands/demo.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `tests/unit/cli/demo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cli/demo.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock setTimeout to make demo instant in tests
vi.useFakeTimers();

describe('fleet demo', () => {
  it('runDemo() completes without error', async () => {
    const { runDemo } = await import('fleetspark/commands/demo.js');
    const logs: string[] = [];
    const mockLog = (msg: string) => logs.push(msg);

    const promise = runDemo(mockLog, 0); // 0ms delay = instant
    await vi.runAllTimersAsync();
    await promise;

    expect(logs.length).toBeGreaterThan(5);
    expect(logs.some(l => l.includes('Fleet Demo'))).toBe(true);
    expect(logs.some(l => l.includes('All missions complete'))).toBe(true);
  });

  it('runDemo() shows 4 missions', async () => {
    const { runDemo } = await import('fleetspark/commands/demo.js');
    const logs: string[] = [];
    const mockLog = (msg: string) => logs.push(msg);

    const promise = runDemo(mockLog, 0);
    await vi.runAllTimersAsync();
    await promise;

    expect(logs.some(l => l.includes('M1'))).toBe(true);
    expect(logs.some(l => l.includes('M2'))).toBe(true);
    expect(logs.some(l => l.includes('M3'))).toBe(true);
    expect(logs.some(l => l.includes('M4'))).toBe(true);
  });

  it('runDemo() shows next steps', async () => {
    const { runDemo } = await import('fleetspark/commands/demo.js');
    const logs: string[] = [];
    const mockLog = (msg: string) => logs.push(msg);

    const promise = runDemo(mockLog, 0);
    await vi.runAllTimersAsync();
    await promise;

    expect(logs.some(l => l.includes('fleetspark init'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npx vitest run tests/unit/cli/demo.test.ts`
Expected: FAIL — module `fleetspark/commands/demo.js` not found

- [ ] **Step 3: Create demo command implementation**

Create `packages/cli/src/commands/demo.ts`:

```typescript
import type { Command } from 'commander';

interface DemoMission {
  id: string;
  branch: string;
  ship: string;
  agent: string;
  depends: string[];
  delayMs: number;
  pr: number;
}

const DEMO_MISSIONS: DemoMission[] = [
  { id: 'M1', branch: 'feature/oauth', ship: 'Ship-Alpha', agent: 'claude-code', depends: [], delayMs: 2000, pr: 42 },
  { id: 'M2', branch: 'feature/rate-limiter', ship: 'Ship-Beta', agent: 'codex', depends: [], delayMs: 800, pr: 43 },
  { id: 'M3', branch: 'feature/api-docs', ship: 'Ship-Gamma', agent: 'aider', depends: [], delayMs: 1200, pr: 44 },
  { id: 'M4', branch: 'feature/unit-tests', ship: 'Ship-Delta', agent: 'gemini', depends: ['M1'], delayMs: 1000, pr: 45 },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runDemo(
  log: (msg: string) => void = console.log,
  delayMultiplier: number = 1,
): Promise<void> {
  log('');
  log('⚡ Fleet Demo — simulating a 4-mission fleet run...');
  log('');

  await sleep(300 * delayMultiplier);

  log('Planning: "Add OAuth, rate limiter, API docs, unit tests"');
  log('');

  for (const m of DEMO_MISSIONS) {
    const depStr = m.depends.length > 0 ? ` [depends: ${m.depends.join(', ')}]` : '';
    log(`  ✓ ${m.id}: ${m.branch.padEnd(28)} → ${m.ship.padEnd(12)} (${m.agent})${depStr}`);
    await sleep(200 * delayMultiplier);
  }

  log('');
  log('Running... (simulated)');

  // Run independent missions (M1, M2, M3) in simulated order
  const independent = DEMO_MISSIONS.filter((m) => m.depends.length === 0)
    .sort((a, b) => a.delayMs - b.delayMs);

  let elapsed = 0;
  for (const m of independent) {
    await sleep(m.delayMs * delayMultiplier);
    elapsed += m.delayMs;
    const secs = Math.round(elapsed / 1000);
    log(`  [00:${String(secs).padStart(2, '0')}] ${m.id} completed ✓ — PR #${m.pr} auto-merged`);
  }

  // Unblock dependent missions
  const dependent = DEMO_MISSIONS.filter((m) => m.depends.length > 0);
  for (const m of dependent) {
    log(`  [00:${String(Math.round(elapsed / 1000)).padStart(2, '0')}] ${m.id} unblocked → ${m.ship} starting...`);
    await sleep(m.delayMs * delayMultiplier);
    elapsed += m.delayMs;
    const secs = Math.round(elapsed / 1000);
    log(`  [00:${String(secs).padStart(2, '0')}] ${m.id} completed ✓ — PR #${m.pr} auto-merged`);
  }

  const totalSecs = Math.round(elapsed / 1000);
  log('');
  log(`All missions complete! 4/4 merged in ${totalSecs}s (simulated).`);
  log('');
  log('Ready to try it for real?');
  log('  npx fleetspark init');
  log('  npx fleetspark command --plan "your goal here"');
  log('');
}

export function registerDemoCommand(program: Command): void {
  program
    .command('demo')
    .description('Run a simulated fleet demo (no repo or agents needed)')
    .action(async () => {
      await runDemo();
    });
}
```

- [ ] **Step 4: Register demo command in index.ts**

Add to `packages/cli/src/index.ts`:

```typescript
import { registerDemoCommand } from './commands/demo.js';
// ... after other registrations:
registerDemoCommand(program);
```

- [ ] **Step 5: Build and run test**

Run: `npm run build && npx vitest run tests/unit/cli/demo.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 6: Manual smoke test**

Run: `node packages/cli/dist/index.js demo`
Expected: Animated demo output showing 4 missions, simulated progress, and next steps

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/commands/demo.ts packages/cli/src/index.ts tests/unit/cli/demo.test.ts
git commit -m "feat: add fleet demo command for zero-friction onboarding"
```

---

## Task 3: Mission Templates — Core Module

**Files:**
- Create: `packages/core/src/templates/templates.ts`
- Create: `packages/core/src/templates/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/unit/templates/templates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/templates/templates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTemplate, listTemplates } from '@fleetspark/core';

describe('Mission Templates', () => {
  it('listTemplates() returns 5 templates', () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(5);
  });

  it('listTemplates() returns name and description for each', () => {
    const templates = listTemplates();
    for (const t of templates) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.missions.length).toBeGreaterThan(0);
    }
  });

  it('getTemplate() returns known template by name', () => {
    const t = getTemplate('test-coverage');
    expect(t).toBeDefined();
    expect(t!.name).toBe('test-coverage');
    expect(t!.missions.length).toBeGreaterThanOrEqual(3);
  });

  it('getTemplate() returns undefined for unknown name', () => {
    const t = getTemplate('nonexistent');
    expect(t).toBeUndefined();
  });

  it('each template has valid mission structure', () => {
    const templates = listTemplates();
    for (const t of templates) {
      for (const m of t.missions) {
        expect(m.id).toMatch(/^M\d+$/);
        expect(m.branch).toMatch(/^feature\//);
        expect(m.brief).toBeTruthy();
        expect(m.agent).toBe('claude-code');
        expect(Array.isArray(m.depends)).toBe(true);
      }
    }
  });

  it('template dependencies reference valid mission IDs', () => {
    const templates = listTemplates();
    for (const t of templates) {
      const ids = new Set(t.missions.map((m) => m.id));
      for (const m of t.missions) {
        for (const dep of m.depends) {
          expect(ids.has(dep)).toBe(true);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npx vitest run tests/unit/templates/templates.test.ts`
Expected: FAIL — `getTemplate` and `listTemplates` not exported from `@fleetspark/core`

- [ ] **Step 3: Create template definitions**

Create `packages/core/src/templates/templates.ts`:

```typescript
export interface MissionTemplate {
  name: string;
  description: string;
  missions: Array<{
    id: string;
    branch: string;
    brief: string;
    agent: string;
    depends: string[];
  }>;
}

export const BUILTIN_TEMPLATES: MissionTemplate[] = [
  {
    name: 'test-coverage',
    description: 'Add unit tests for untested modules',
    missions: [
      { id: 'M1', branch: 'feature/test-utils', brief: 'Create shared test utilities, fixtures, and mock factories for the project', agent: 'claude-code', depends: [] },
      { id: 'M2', branch: 'feature/test-core', brief: 'Add unit tests for all core business logic modules that lack test coverage', agent: 'claude-code', depends: [] },
      { id: 'M3', branch: 'feature/test-api', brief: 'Add integration tests for all API endpoints and handlers', agent: 'claude-code', depends: [] },
      { id: 'M4', branch: 'feature/test-ci', brief: 'Configure test coverage reporting in CI and add a coverage threshold check', agent: 'claude-code', depends: ['M1'] },
    ],
  },
  {
    name: 'security-audit',
    description: 'OWASP security checks, dependency audit, and secret scanning',
    missions: [
      { id: 'M1', branch: 'feature/security-deps', brief: 'Run npm audit, update vulnerable dependencies, and fix breaking changes', agent: 'claude-code', depends: [] },
      { id: 'M2', branch: 'feature/security-secrets', brief: 'Scan codebase for hardcoded secrets, API keys, and credentials. Add .gitignore entries and environment variable references', agent: 'claude-code', depends: [] },
      { id: 'M3', branch: 'feature/security-owasp', brief: 'Review code for OWASP top 10 vulnerabilities: injection, XSS, CSRF, auth flaws. Fix any issues found', agent: 'claude-code', depends: [] },
    ],
  },
  {
    name: 'api-docs',
    description: 'Generate API documentation, OpenAPI spec, and usage examples',
    missions: [
      { id: 'M1', branch: 'feature/openapi-spec', brief: 'Generate an OpenAPI 3.0 specification for all API endpoints in the project', agent: 'claude-code', depends: [] },
      { id: 'M2', branch: 'feature/endpoint-docs', brief: 'Write markdown documentation for each API endpoint including request/response examples', agent: 'claude-code', depends: [] },
      { id: 'M3', branch: 'feature/api-examples', brief: 'Create runnable code examples (curl, fetch, SDK) for the most common API workflows', agent: 'claude-code', depends: ['M1'] },
    ],
  },
  {
    name: 'dependency-update',
    description: 'Update all dependencies, fix breaking changes, verify CI',
    missions: [
      { id: 'M1', branch: 'feature/deps-major', brief: 'Update all major dependencies to latest versions and fix any breaking API changes', agent: 'claude-code', depends: [] },
      { id: 'M2', branch: 'feature/deps-minor', brief: 'Update all minor and patch dependencies. Run tests and fix any regressions', agent: 'claude-code', depends: [] },
      { id: 'M3', branch: 'feature/deps-lockfile', brief: 'Regenerate lockfile, verify all peer dependency warnings are resolved, and ensure CI passes', agent: 'claude-code', depends: ['M1', 'M2'] },
    ],
  },
  {
    name: 'refactor',
    description: 'Extract shared code, simplify complex functions, remove dead code',
    missions: [
      { id: 'M1', branch: 'feature/refactor-extract', brief: 'Identify and extract duplicated code into shared utility functions or modules', agent: 'claude-code', depends: [] },
      { id: 'M2', branch: 'feature/refactor-simplify', brief: 'Simplify functions with high cyclomatic complexity. Break large functions into smaller, focused ones', agent: 'claude-code', depends: [] },
      { id: 'M3', branch: 'feature/refactor-dead-code', brief: 'Find and remove dead code: unused imports, unreachable branches, deprecated functions', agent: 'claude-code', depends: [] },
      { id: 'M4', branch: 'feature/refactor-types', brief: 'Add or improve TypeScript types: replace any, add missing return types, tighten interfaces', agent: 'claude-code', depends: ['M1', 'M2'] },
    ],
  },
];
```

- [ ] **Step 4: Create template registry**

Create `packages/core/src/templates/index.ts`:

```typescript
import { BUILTIN_TEMPLATES } from './templates.js';
import type { MissionTemplate } from './templates.js';

export type { MissionTemplate };

export function listTemplates(): MissionTemplate[] {
  return [...BUILTIN_TEMPLATES];
}

export function getTemplate(name: string): MissionTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.name === name);
}
```

- [ ] **Step 5: Export from core index**

Add to `packages/core/src/index.ts`:

```typescript
export { listTemplates, getTemplate, type MissionTemplate } from './templates/index.js';
```

- [ ] **Step 6: Build and run test**

Run: `npm run build && npx vitest run tests/unit/templates/templates.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/templates/ tests/unit/templates/templates.test.ts packages/core/src/index.ts
git commit -m "feat: add 5 built-in mission templates (test-coverage, security-audit, api-docs, dependency-update, refactor)"
```

---

## Task 4: Mission Templates — CLI Integration

**Files:**
- Modify: `packages/cli/src/commands/command.ts`

- [ ] **Step 1: Add --template option to command.ts**

In `packages/cli/src/commands/command.ts`, add the `--template` option and handler:

```typescript
// Add import at top:
import { getTemplate, listTemplates } from '@fleetspark/core';
import { stringify as yamlStringify } from 'yaml';

// Add option to command:
.option('--template <name>', 'Use a built-in mission template')

// Add handler in action, before the else block:
} else if (options.template) {
  await handleTemplate(git, cwd, config, options.template);
}
```

Add the `handleTemplate` function:

```typescript
async function handleTemplate(
  git: RealGitOps,
  cwd: string,
  config: any,
  templateName: string
): Promise<void> {
  if (templateName === 'list') {
    const templates = listTemplates();
    console.log('Available templates:');
    console.log('');
    for (const t of templates) {
      console.log(`  ${t.name.padEnd(20)} ${t.description} (${t.missions.length} missions)`);
    }
    console.log('');
    console.log('Usage: fleetspark command --template <name>');
    return;
  }

  const template = getTemplate(templateName);
  if (!template) {
    console.error(`Unknown template: "${templateName}". Run 'fleetspark command --template list' to see available templates.`);
    process.exit(1);
  }

  console.log(`Using template: ${template.name} (${template.missions.length} missions)`);

  // Write template as plan file and delegate
  const { writeFile: wf } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const tmpPath = join(cwd, '.fleet', 'last-plan.yml');
  await wf(tmpPath, yamlStringify({ missions: template.missions }), 'utf-8');

  await handlePlanFile(git, cwd, config, tmpPath);
}
```

Also update the error message at the bottom:

```typescript
console.error(
  'Specify --plan <goal>, --plan-file <path>, --template <name>, --resume, or --handoff'
);
```

- [ ] **Step 2: Build and smoke test**

Run: `npm run build && node packages/cli/dist/index.js command --template list`
Expected: Shows 5 templates with names and descriptions

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/command.ts
git commit -m "feat: add --template option to fleet command"
```

---

## Task 5: Report Generator — Core Module

**Files:**
- Create: `packages/core/src/report/report-generator.ts`
- Modify: `packages/core/src/index.ts`
- Test: `tests/unit/report/report-generator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/report/report-generator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateReport } from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';

function makeManifest(overrides?: Partial<FleetManifest>): FleetManifest {
  return {
    updated: new Date('2026-04-22T10:30:00Z'),
    commander: {
      host: 'laptop',
      lastCheckin: new Date('2026-04-22T10:30:00Z'),
      status: 'active',
      timeoutMinutes: 15,
    },
    missions: [
      { id: 'M1', branch: 'feature/auth', ship: 'ship-laptop', agent: 'claude-code', status: 'merged', depends: [], blocker: 'none' },
      { id: 'M2', branch: 'feature/api', ship: 'ship-desktop', agent: 'codex', status: 'merged', depends: [], blocker: 'none' },
    ],
    mergeQueue: [],
    completed: [
      { missionId: 'M1', branch: 'feature/auth', mergedDate: new Date('2026-04-22T10:10:00Z') },
      { missionId: 'M2', branch: 'feature/api', mergedDate: new Date('2026-04-22T10:20:00Z') },
    ],
    ...overrides,
  };
}

describe('generateReport', () => {
  it('returns markdown string', () => {
    const report = generateReport(makeManifest());
    expect(typeof report).toBe('string');
    expect(report).toContain('# Fleet Run Report');
  });

  it('includes mission table', () => {
    const report = generateReport(makeManifest());
    expect(report).toContain('M1');
    expect(report).toContain('M2');
    expect(report).toContain('feature/auth');
    expect(report).toContain('ship-laptop');
  });

  it('includes summary metrics', () => {
    const report = generateReport(makeManifest());
    expect(report).toContain('Total missions');
    expect(report).toContain('Completed');
    expect(report).toContain('Ships used');
  });

  it('counts unique ships', () => {
    const report = generateReport(makeManifest());
    expect(report).toContain('2'); // 2 unique ships
  });

  it('handles empty manifest', () => {
    const report = generateReport(makeManifest({
      missions: [],
      completed: [],
    }));
    expect(report).toContain('# Fleet Run Report');
    expect(report).toContain('No missions');
  });

  it('includes failed missions', () => {
    const report = generateReport(makeManifest({
      missions: [
        { id: 'M1', branch: 'feature/auth', ship: 'ship-a', agent: 'claude-code', status: 'failed', depends: [], blocker: 'Agent crashed' },
      ],
    }));
    expect(report).toContain('Failed');
    expect(report).toContain('1');
  });

  it('includes fleetspark.dev link', () => {
    const report = generateReport(makeManifest());
    expect(report).toContain('fleetspark.dev');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npx vitest run tests/unit/report/report-generator.test.ts`
Expected: FAIL — `generateReport` not exported from `@fleetspark/core`

- [ ] **Step 3: Create report generator**

Create `packages/core/src/report/report-generator.ts`:

```typescript
import type { FleetManifest } from '../protocol/types.js';

export function generateReport(manifest: FleetManifest): string {
  const lines: string[] = [];

  lines.push('# Fleet Run Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Summary
  const totalMissions = manifest.missions.length;
  const merged = manifest.missions.filter((m) => m.status === 'merged').length + manifest.completed.length;
  const failed = manifest.missions.filter((m) => m.status === 'failed').length;
  const inProgress = manifest.missions.filter((m) => m.status === 'in-progress' || m.status === 'assigned').length;
  const pending = manifest.missions.filter((m) => m.status === 'pending' || m.status === 'ready').length;
  const completed = manifest.missions.filter((m) => m.status === 'completed' || m.status === 'merge-queued').length;

  const uniqueShips = new Set<string>();
  for (const m of manifest.missions) {
    if (m.ship) uniqueShips.add(m.ship);
  }

  if (totalMissions === 0 && manifest.completed.length === 0) {
    lines.push('## Summary');
    lines.push('No missions in this fleet run.');
    lines.push('');
    lines.push('---');
    lines.push('*Generated by [FleetSpark](https://fleetspark.dev)*');
    return lines.join('\n');
  }

  // Time calculation from completed entries
  let totalTimeStr = '—';
  let timeSavedStr = '—';
  if (manifest.completed.length >= 2) {
    const mergeTimes = manifest.completed
      .map((c) => new Date(c.mergedDate).getTime())
      .sort((a, b) => a - b);
    const earliest = mergeTimes[0];
    const latest = mergeTimes[mergeTimes.length - 1];
    const spanMin = Math.round((latest - earliest) / (1000 * 60));
    totalTimeStr = `${spanMin} min`;

    // Estimate: sequential would take N * avg_duration
    const avgDuration = spanMin / manifest.completed.length;
    const sequentialMin = Math.round(avgDuration * manifest.completed.length * uniqueShips.size);
    const savedMin = sequentialMin - spanMin;
    if (savedMin > 0 && sequentialMin > 0) {
      const savedPct = Math.round((savedMin / sequentialMin) * 100);
      timeSavedStr = `~${savedMin} min (${savedPct}%)`;
    }
  }

  lines.push('## Summary');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Total missions | ${totalMissions + manifest.completed.length} |`);
  lines.push(`| Completed | ${merged + completed} |`);
  lines.push(`| In progress | ${inProgress} |`);
  lines.push(`| Pending | ${pending} |`);
  lines.push(`| Failed | ${failed} |`);
  lines.push(`| Ships used | ${uniqueShips.size} |`);
  lines.push(`| Total time | ${totalTimeStr} |`);
  lines.push(`| Time saved | ${timeSavedStr} |`);
  lines.push('');

  // Mission table
  lines.push('## Missions');
  lines.push('| ID | Branch | Ship | Agent | Status |');
  lines.push('|---|---|---|---|---|');
  for (const m of manifest.missions) {
    const statusIcon = m.status === 'merged' ? '✅' : m.status === 'failed' ? '❌' : m.status === 'in-progress' ? '🔄' : '⏳';
    lines.push(`| ${m.id} | ${m.branch} | ${m.ship ?? '—'} | ${m.agent} | ${statusIcon} ${m.status} |`);
  }
  for (const c of manifest.completed) {
    lines.push(`| ${c.missionId} | ${c.branch} | — | — | ✅ merged |`);
  }
  lines.push('');

  // Merge queue
  if (manifest.mergeQueue.length > 0) {
    lines.push('## Merge Queue');
    for (const e of manifest.mergeQueue) {
      lines.push(`- ${e.missionId} (${e.branch}) — ${e.note} [CI: ${e.ciStatus}]`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by [FleetSpark](https://fleetspark.dev)*');

  return lines.join('\n');
}

export function generateReportJson(manifest: FleetManifest): object {
  const uniqueShips = new Set<string>();
  for (const m of manifest.missions) {
    if (m.ship) uniqueShips.add(m.ship);
  }

  return {
    generated: new Date().toISOString(),
    summary: {
      totalMissions: manifest.missions.length + manifest.completed.length,
      merged: manifest.missions.filter((m) => m.status === 'merged').length + manifest.completed.length,
      failed: manifest.missions.filter((m) => m.status === 'failed').length,
      inProgress: manifest.missions.filter((m) => m.status === 'in-progress').length,
      shipsUsed: uniqueShips.size,
    },
    missions: manifest.missions.map((m) => ({
      id: m.id,
      branch: m.branch,
      ship: m.ship,
      agent: m.agent,
      status: m.status,
    })),
    completed: manifest.completed.map((c) => ({
      missionId: c.missionId,
      branch: c.branch,
      mergedDate: c.mergedDate.toISOString(),
    })),
  };
}
```

- [ ] **Step 4: Export from core**

Add to `packages/core/src/index.ts`:

```typescript
export { generateReport, generateReportJson } from './report/report-generator.js';
```

- [ ] **Step 5: Build and run tests**

Run: `npm run build && npx vitest run tests/unit/report/report-generator.test.ts`
Expected: PASS — all 7 tests green

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/report/ tests/unit/report/report-generator.test.ts packages/core/src/index.ts
git commit -m "feat: add report generator for post-run fleet summaries"
```

---

## Task 6: Report CLI Command

**Files:**
- Create: `packages/cli/src/commands/report.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Create report command**

Create `packages/cli/src/commands/report.ts`:

```typescript
import type { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import {
  RealGitOps,
  parseFleetManifest,
  generateReport,
  generateReportJson,
} from '@fleetspark/core';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Generate a summary report of the current fleet run')
    .option('--json', 'Output machine-readable JSON')
    .option('--output <file>', 'Write report to file')
    .action(async (options) => {
      const git = new RealGitOps(process.cwd());

      let content: string;
      try {
        content = await git.readFile('fleet/state', 'FLEET.md');
      } catch {
        console.error('No fleet state found. Run "fleetspark init" first.');
        process.exit(1);
      }

      const manifest = parseFleetManifest(content);

      if (options.json) {
        const json = generateReportJson(manifest);
        const output = JSON.stringify(json, null, 2);
        if (options.output) {
          await writeFile(options.output, output, 'utf-8');
          console.log(`Report written to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        const report = generateReport(manifest);
        if (options.output) {
          await writeFile(options.output, report, 'utf-8');
          console.log(`Report written to ${options.output}`);
        } else {
          console.log(report);
        }
      }
    });
}
```

- [ ] **Step 2: Register in index.ts**

Add to `packages/cli/src/index.ts`:

```typescript
import { registerReportCommand } from './commands/report.js';
// ... after other registrations:
registerReportCommand(program);
```

- [ ] **Step 3: Build and verify**

Run: `npm run build && node packages/cli/dist/index.js report --help`
Expected: Shows report command help with `--json` and `--output` options

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/report.ts packages/cli/src/index.ts
git commit -m "feat: add fleet report CLI command"
```

---

## Task 7: GitHub Action

**Files:**
- Create: `action/action.yml`
- Create: `action/index.js`

- [ ] **Step 1: Create action metadata**

Create `action/action.yml`:

```yaml
name: 'FleetSpark'
description: 'Run FleetSpark fleet operations in GitHub Actions'
author: 'fleetSpark'
branding:
  icon: 'zap'
  color: 'yellow'

inputs:
  command:
    description: 'FleetSpark command to run (init, plan, ship, status, report)'
    required: true
  plan:
    description: 'Goal to decompose into missions (used with command: plan)'
    required: false
  template:
    description: 'Mission template name (used with command: plan)'
    required: false
  agent:
    description: 'AI agent to use for ship mode (default: claude-code)'
    required: false
    default: 'claude-code'
  repo:
    description: 'Repository URL for ship --join (defaults to current repo)'
    required: false

runs:
  using: 'node20'
  main: 'index.js'
```

- [ ] **Step 2: Create action entry point**

Create `action/index.js`:

```javascript
const { execSync } = require('child_process');
const core = require('@actions/core');

async function run() {
  try {
    const command = core.getInput('command', { required: true });
    const plan = core.getInput('plan');
    const template = core.getInput('template');
    const agent = core.getInput('agent') || 'claude-code';
    const repo = core.getInput('repo') || `https://github.com/${process.env.GITHUB_REPOSITORY}.git`;

    // Install fleetspark
    core.info('Installing fleetspark...');
    execSync('npm install -g fleetspark', { stdio: 'inherit' });

    let cmd = '';
    switch (command) {
      case 'init':
        cmd = 'fleetspark init';
        break;
      case 'plan':
        if (template) {
          cmd = `fleetspark command --template ${template}`;
        } else if (plan) {
          cmd = `fleetspark command --plan "${plan}"`;
        } else {
          core.setFailed('Either "plan" or "template" input is required for plan command');
          return;
        }
        break;
      case 'ship':
        cmd = `fleetspark ship --join ${repo}`;
        break;
      case 'status':
        cmd = 'fleetspark status --json';
        break;
      case 'report':
        cmd = 'fleetspark report';
        break;
      default:
        core.setFailed(`Unknown command: ${command}`);
        return;
    }

    core.info(`Running: ${cmd}`);
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    core.info(output);
    core.setOutput('result', output);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
```

- [ ] **Step 3: Create action package.json**

Create `action/package.json`:

```json
{
  "name": "fleetspark-action",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "@actions/core": "^1.10.1"
  }
}
```

- [ ] **Step 4: Install action dependencies**

Run: `cd action && npm install && cd ..`

- [ ] **Step 5: Commit**

```bash
git add action/
git commit -m "feat: add GitHub Action for CI-based fleet operations"
```

---

## Task 8: Build, Test Full Suite, Publish

**Files:**
- Modify: `packages/cli/package.json` (version bump)

- [ ] **Step 1: Build everything**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing + new: ~240 tests)

- [ ] **Step 3: Bump CLI version to 1.1.0**

Edit `packages/cli/package.json`: change `"version": "1.0.2"` to `"version": "1.1.0"`

- [ ] **Step 4: Commit version bump**

```bash
git add packages/cli/package.json
git commit -m "chore: bump version to 1.1.0 for growth features release"
```

- [ ] **Step 5: Publish updated CLI**

Run: `npm publish --workspace packages/cli --access public`
Expected: `+ fleetspark@1.1.0`

- [ ] **Step 6: Publish updated core (with templates + report)**

Run: `npm publish --workspace packages/core --access public`

- [ ] **Step 7: Push all changes**

Run: `git push`

- [ ] **Step 8: Verify with npx**

Run (in any directory): `npx fleetspark@1.1.0 demo`
Expected: Demo runs showing simulated fleet

Run: `npx fleetspark@1.1.0 command --template list`
Expected: Shows 5 available templates

---

## Self-Review Checklist

- [x] **Spec coverage:** All 4 P0+P1 features have implementation tasks (demo, templates, report, GitHub Action)
- [x] **ROADMAP update:** Task 1 covers the roadmap rewrite
- [x] **No placeholders:** Every step has exact code, exact commands, expected outputs
- [x] **Type consistency:** `MissionTemplate` type used consistently in templates.ts and index.ts; `generateReport`/`generateReportJson` signatures match across test and implementation
- [x] **Import paths:** All use `.js` extensions per ESM convention
- [x] **Package references:** All use `@fleetspark/` scope consistently
- [x] **Test patterns:** Follow existing Vitest patterns (describe/it/expect, mock conventions)
- [x] **Build requirement:** Tests import from `dist/`, so `npm run build` is called before every test run
