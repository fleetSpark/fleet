import { describe, it, expect } from 'vitest';
import { computeBenchmarks, renderBenchmarks } from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';

function manifest(missions: FleetManifest['missions']): FleetManifest {
  return {
    updated: new Date('2026-06-01T10:00:00Z'),
    commander: { host: 'd', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
    missions,
    mergeQueue: [],
    completed: [],
  };
}

const m = (id: string, agent: string, status: FleetManifest['missions'][number]['status']) => ({
  id,
  branch: `b/${id}`,
  ship: 's1',
  agent,
  status,
  depends: [],
  blocker: 'none',
});

describe('computeBenchmarks', () => {
  it('computes per-agent success rate from terminal outcomes', () => {
    const report = computeBenchmarks(
      manifest([
        m('M1', 'claude', 'merged'),
        m('M2', 'claude', 'merged'),
        m('M3', 'claude', 'failed'),
        m('M4', 'codex', 'merged'),
        m('M5', 'codex', 'stalled'),
      ]),
      { minSample: 1 },
    );
    const claude = report.agents.find((a) => a.agent === 'claude')!;
    const codex = report.agents.find((a) => a.agent === 'codex')!;
    expect(claude.successRate).toBeCloseTo(2 / 3);
    expect(codex.successRate).toBeCloseTo(1 / 2);
  });

  it('returns null success rate when no terminal outcomes', () => {
    const report = computeBenchmarks(manifest([m('M1', 'aider', 'in-progress')]));
    expect(report.agents[0].successRate).toBeNull();
  });

  it('picks best-fit by highest success rate above min sample', () => {
    const report = computeBenchmarks(
      manifest([
        m('M1', 'claude', 'merged'),
        m('M2', 'claude', 'merged'),
        m('M3', 'claude', 'merged'),
        m('M4', 'codex', 'merged'),
        m('M5', 'codex', 'failed'),
        m('M6', 'codex', 'failed'),
      ]),
      { minSample: 3 },
    );
    expect(report.bestFit).toBe('claude');
  });

  it('excludes agents below min sample from best-fit', () => {
    const report = computeBenchmarks(
      manifest([m('M1', 'newbie', 'merged'), m('M2', 'newbie', 'merged')]),
      { minSample: 5 },
    );
    expect(report.bestFit).toBeNull();
  });

  it('aggregates across multiple manifests', () => {
    const report = computeBenchmarks(
      [manifest([m('M1', 'claude', 'merged')]), manifest([m('M2', 'claude', 'failed')])],
      { minSample: 1 },
    );
    const claude = report.agents.find((a) => a.agent === 'claude')!;
    expect(claude.total).toBe(2);
    expect(report.sampleSize).toBe(2);
  });

  it('computes average duration when durations supplied', () => {
    const report = computeBenchmarks(
      manifest([m('M1', 'claude', 'merged'), m('M2', 'claude', 'merged')]),
      { durationsMin: { M1: 10, M2: 20 } },
    );
    expect(report.agents[0].avgDurationMin).toBe(15);
  });

  it('renders a markdown table with best fit', () => {
    const report = computeBenchmarks(manifest([m('M1', 'claude', 'merged')]), { minSample: 1 });
    const md = renderBenchmarks(report);
    expect(md).toContain('# Agent Performance Benchmarks');
    expect(md).toContain('claude');
    expect(md).toContain('Best fit:');
  });
});
