import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load as yamlLoad } from 'js-yaml';

export interface ReviewGateField {
  artifact: string | null;
  self_review: string | null;
  peer_review: string | null;
}

export interface Workstream {
  id: string;
  branch: string;
  status: string;
  phase: string;
  maturity_level: string;  // "1" | "2" | "3" | "4"
  merge_gate: string;      // "ready" | "not_ready" | "merged"
  scope?: string[];
  review_gate: {
    spec: ReviewGateField;
    plan: ReviewGateField;
    code: ReviewGateField;
    tests_uat: string | null;
  };
}

export interface AdapterConfig {
  version: string;
  state: {
    workstreams: string;
    review_artifacts?: string;
  };
}

/**
 * Read .drsti/adapter.yml to get the path to workstreams.json.
 * Returns null if no adapter.yml exists (plugin degrades gracefully).
 */
export async function readAdapterConfig(workDir: string): Promise<AdapterConfig | null> {
  try {
    const raw = await readFile(join(workDir, '.drsti', 'adapter.yml'), 'utf8');
    return yamlLoad(raw) as AdapterConfig;
  } catch {
    return null;
  }
}

/**
 * Read and parse workstreams.json.
 * Returns an empty array if the file does not exist.
 */
export async function readWorkstreams(workDir: string, relativePath: string): Promise<Workstream[]> {
  try {
    const raw = await readFile(join(workDir, relativePath), 'utf8');
    return JSON.parse(raw) as Workstream[];
  } catch {
    return [];
  }
}

/**
 * Find the workstream whose branch matches the mission branch.
 */
export function findWorkstreamForBranch(workstreams: Workstream[], branch: string): Workstream | undefined {
  return workstreams.find((ws) => ws.branch === branch);
}
