import { validateDAG } from '../scheduler/dag.js';
import type { Mission } from '../protocol/types.js';

/** A single mission as emitted by an external planner. */
export interface PlanMissionSpec {
  id: string;
  branch: string;
  brief: string;
  agent?: string;
  depends?: string[];
}

/**
 * A validated, conflict-checked batch of missions produced by an external
 * planner (e.g. a scheduled PM agent). This is the third plan source alongside
 * `--plan` (LLM) and `--plan-file` (hand-written YAML): a planner feeds missions
 * directly instead of a human authoring YAML.
 *
 * The `approved` and `conflictChecked` flags are the contract: Fleet refuses to
 * dispatch a batch the planner has not explicitly marked as both.
 */
export interface BatchBlock {
  /** Identifier of the planner/source that produced this batch. */
  source: string;
  /** The planner asserts a human (or policy) approved this batch. */
  approved: boolean;
  /** The planner asserts it ran conflict detection on this batch. */
  conflictChecked: boolean;
  missions: PlanMissionSpec[];
  /** Optional free-form note carried into the commander log. */
  note?: string;
}

/**
 * A plug-in source of batch blocks. A concrete adapter (cron PM agent, queue
 * consumer, etc.) implements `fetch()` to return the next ready batch.
 */
export interface PlanSource {
  name: string;
  fetch(): Promise<BatchBlock>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a batch block before it is allowed to create missions. Enforces the
 * planner contract (approved + conflict-checked), structural integrity, unique
 * mission IDs, resolvable dependencies, and an acyclic DAG.
 */
export function validateBatchBlock(block: BatchBlock): ValidationResult {
  const errors: string[] = [];

  if (!block || typeof block !== 'object') {
    return { valid: false, errors: ['Batch block is not an object'] };
  }
  if (!block.source || typeof block.source !== 'string') {
    errors.push('Batch block missing "source"');
  }
  if (block.approved !== true) {
    errors.push('Batch block is not approved (approved must be true)');
  }
  if (block.conflictChecked !== true) {
    errors.push('Batch block was not conflict-checked (conflictChecked must be true)');
  }
  if (!Array.isArray(block.missions) || block.missions.length === 0) {
    errors.push('Batch block has no missions');
    return { valid: errors.length === 0, errors };
  }

  const ids = new Set<string>();
  for (const m of block.missions) {
    if (!m.id || !m.branch || !m.brief) {
      errors.push(`Mission "${m.id ?? '?'}" missing required field (id, branch, brief)`);
      continue;
    }
    if (ids.has(m.id)) {
      errors.push(`Duplicate mission id "${m.id}"`);
    }
    ids.add(m.id);
  }

  for (const m of block.missions) {
    for (const dep of m.depends ?? []) {
      if (!ids.has(dep)) {
        errors.push(`Mission "${m.id}" depends on unknown mission "${dep}"`);
      }
    }
  }

  // Reuse the core DAG validator for cycle detection.
  const asMissions: Mission[] = block.missions.map((m) => ({
    id: m.id,
    branch: m.branch,
    ship: null,
    agent: m.agent ?? 'claude-code',
    status: 'pending',
    depends: m.depends ?? [],
    blocker: 'none',
  }));
  const dag = validateDAG(asMissions);
  if (!dag.valid) {
    errors.push(`Circular dependency detected involving: ${(dag.cycles ?? []).join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

function coerceBatchBlock(raw: unknown, source: string): BatchBlock {
  const obj = (raw ?? {}) as Partial<BatchBlock> & { missions?: PlanMissionSpec[] };
  return {
    source: obj.source ?? source,
    approved: obj.approved === true,
    conflictChecked: obj.conflictChecked === true,
    missions: Array.isArray(obj.missions) ? obj.missions : [],
    ...(obj.note ? { note: obj.note } : {}),
  };
}

/**
 * Built-in named plan-source adapters. Real deployments register their own;
 * the registry keeps `--plan-source <name>` symmetric with the adapter registry.
 */
const PLAN_SOURCE_REGISTRY = new Map<string, () => PlanSource>();

export function registerPlanSource(name: string, factory: () => PlanSource): void {
  PLAN_SOURCE_REGISTRY.set(name, factory);
}

export function resolvePlanSource(name: string): PlanSource | null {
  const factory = PLAN_SOURCE_REGISTRY.get(name);
  return factory ? factory() : null;
}

/**
 * Load a batch block from a source string. If the string points at a `.json`,
 * `.yml`, or `.yaml` file, it is read and parsed as an emitted batch block.
 * Otherwise it is treated as a registered named plan-source adapter.
 */
export async function loadBatchBlock(
  source: string,
  deps?: {
    readFile?: (p: string) => Promise<string>;
    parseYaml?: (s: string) => unknown;
  }
): Promise<BatchBlock> {
  const isFile = /\.(json|ya?ml)$/i.test(source);
  if (isFile) {
    const readFile =
      deps?.readFile ?? ((p: string) => import('node:fs/promises').then((m) => m.readFile(p, 'utf-8')));
    const content = await readFile(source);
    let raw: unknown;
    if (/\.json$/i.test(source)) {
      raw = JSON.parse(content);
    } else if (deps?.parseYaml) {
      raw = deps.parseYaml(content);
    } else {
      const { parse } = await import('yaml');
      raw = parse(content);
    }
    return coerceBatchBlock(raw, source);
  }

  const planSource = resolvePlanSource(source);
  if (!planSource) {
    throw new Error(
      `Unknown plan source "${source}". Provide a .json/.yml batch file or a registered plan-source name.`
    );
  }
  return planSource.fetch();
}
