import type { FleetManifest, Mission, MissionStatus } from '../protocol/types.js';

export interface AgentBenchmark {
  agent: string;
  total: number;
  merged: number;
  failed: number;
  stalled: number;
  inProgress: number;
  pending: number;
  /** merged / (merged + failed + stalled); null when no terminal outcomes yet. */
  successRate: number | null;
  /** Average minutes from first-seen to merge, when durations are available. */
  avgDurationMin: number | null;
}

export interface BenchmarkReport {
  generatedAt: string;
  agents: AgentBenchmark[];
  /** Agent with the highest success rate meeting the sample threshold. */
  bestFit: string | null;
  /** Total missions considered across all manifests. */
  sampleSize: number;
}

export interface BenchmarkOptions {
  /** Minimum terminal outcomes an agent needs before it can be "best fit". */
  minSample?: number;
  /** Optional per-mission durations (minutes) keyed by mission id. */
  durationsMin?: Record<string, number>;
}

const TERMINAL_SUCCESS: MissionStatus[] = ['merged'];
const TERMINAL_FAILURE: MissionStatus[] = ['failed', 'stalled'];

/**
 * Per-agent success rate, throughput, and best-fit tracking, computed from one
 * or more fleet manifests (pass a history array to aggregate across runs).
 */
export function computeBenchmarks(
  input: FleetManifest | FleetManifest[],
  opts: BenchmarkOptions = {}
): BenchmarkReport {
  const manifests = Array.isArray(input) ? input : [input];
  const minSample = opts.minSample ?? 3;
  const durations = opts.durationsMin ?? {};

  const byAgent = new Map<string, Mission[]>();
  let sampleSize = 0;
  for (const manifest of manifests) {
    for (const m of manifest.missions) {
      sampleSize++;
      const list = byAgent.get(m.agent) ?? [];
      list.push(m);
      byAgent.set(m.agent, list);
    }
  }

  const agents: AgentBenchmark[] = [];
  for (const [agent, missions] of byAgent) {
    const count = (statuses: MissionStatus[]) =>
      missions.filter((m) => statuses.includes(m.status)).length;
    const merged = count(TERMINAL_SUCCESS);
    const failed = count(['failed']);
    const stalled = count(['stalled']);
    const inProgress = count(['in-progress', 'assigned', 'merge-queued', 'completed']);
    const pending = count(['pending', 'ready', 'blocked']);
    const terminal = merged + failed + stalled;
    const successRate = terminal > 0 ? merged / terminal : null;

    const durationVals = missions
      .map((m) => durations[m.id])
      .filter((d): d is number => typeof d === 'number' && d >= 0);
    const avgDurationMin =
      durationVals.length > 0
        ? Math.round(durationVals.reduce((a, b) => a + b, 0) / durationVals.length)
        : null;

    agents.push({
      agent,
      total: missions.length,
      merged,
      failed,
      stalled,
      inProgress,
      pending,
      successRate,
      avgDurationMin,
    });
  }

  // Sort by success rate desc (nulls last), then by throughput.
  agents.sort((a, b) => {
    const ar = a.successRate ?? -1;
    const br = b.successRate ?? -1;
    if (br !== ar) return br - ar;
    return b.merged - a.merged;
  });

  // Best fit: highest success rate among agents with enough terminal samples.
  let bestFit: string | null = null;
  let bestScore = -1;
  for (const a of agents) {
    const terminal = a.merged + a.failed + a.stalled;
    if (terminal >= minSample && a.successRate !== null && a.successRate > bestScore) {
      bestScore = a.successRate;
      bestFit = a.agent;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    agents,
    bestFit,
    sampleSize,
  };
}

function pct(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

export function renderBenchmarks(report: BenchmarkReport): string {
  const lines: string[] = [];
  lines.push('# Agent Performance Benchmarks');
  lines.push('');
  lines.push(`> Generated: ${report.generatedAt}  ·  ${report.sampleSize} missions sampled`);
  lines.push('');
  if (report.agents.length === 0) {
    lines.push('No agent activity recorded.');
    return lines.join('\n');
  }
  lines.push('| Agent | Total | Merged | Failed | Stalled | Success | Avg Duration |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const a of report.agents) {
    const dur = a.avgDurationMin === null ? '—' : `${a.avgDurationMin} min`;
    lines.push(
      `| ${a.agent} | ${a.total} | ${a.merged} | ${a.failed} | ${a.stalled} | ${pct(a.successRate)} | ${dur} |`
    );
  }
  lines.push('');
  lines.push(`**Best fit:** ${report.bestFit ?? 'insufficient data'}`);
  return lines.join('\n');
}
