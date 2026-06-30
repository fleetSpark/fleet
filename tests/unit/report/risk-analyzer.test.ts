import { describe, it, expect } from 'vitest';
import { analyzeRisk, renderRiskPanel } from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';

function makeManifest(overrides: Partial<FleetManifest> = {}): FleetManifest {
  return {
    updated: new Date('2026-06-01T10:00:00Z'),
    commander: { host: 'dev', lastCheckin: new Date('2026-06-01T10:00:00Z'), status: 'active', timeoutMinutes: 15 },
    missions: [],
    mergeQueue: [],
    completed: [],
    ...overrides,
  };
}

const now = new Date('2026-06-01T10:10:00Z');

describe('analyzeRisk', () => {
  it('returns healthy with no risks for an all-merged fleet', () => {
    const manifest = makeManifest({
      missions: [
        { id: 'M1', branch: 'a', ship: 's1', agent: 'c', status: 'merged', depends: [], blocker: 'none' },
      ],
    });
    const report = analyzeRisk(manifest, { now });
    expect(report.level).toBe('healthy');
    expect(report.score).toBe(0);
    expect(report.items).toHaveLength(0);
  });

  it('flags CI failures from the merge queue', () => {
    const manifest = makeManifest({
      missions: [{ id: 'M1', branch: 'a', ship: 's1', agent: 'c', status: 'merge-queued', depends: [], blocker: 'none' }],
      mergeQueue: [{ missionId: 'M1', branch: 'a', ciStatus: 'failed', note: '' }],
    });
    const report = analyzeRisk(manifest, { now });
    expect(report.signals.ciFailures).toBe(1);
    expect(report.items.some((i) => i.kind === 'ci-failure')).toBe(true);
  });

  it('flags stalled missions as high severity', () => {
    const manifest = makeManifest({
      missions: [{ id: 'M1', branch: 'a', ship: 's1', agent: 'c', status: 'stalled', depends: [], blocker: 'Ship unresponsive' }],
    });
    const report = analyzeRisk(manifest, { now });
    expect(report.signals.stalledMissions).toBe(1);
    expect(report.items.find((i) => i.kind === 'stalled-mission')?.severity).toBe('high');
  });

  it('flags aging in-flight missions past the threshold', () => {
    const manifest = makeManifest({
      updated: new Date('2026-06-01T08:00:00Z'), // 130 min before `now`
      missions: [{ id: 'M1', branch: 'a', ship: 's1', agent: 'c', status: 'in-progress', depends: [], blocker: 'none' }],
    });
    const report = analyzeRisk(manifest, { now, agingThresholdMin: 60 });
    expect(report.signals.agingMissions).toBe(1);
    expect(report.items.some((i) => i.kind === 'aging-mission')).toBe(true);
  });

  it('flags idle ships while the queue is non-empty', () => {
    const manifest = makeManifest({
      missions: [
        { id: 'M1', branch: 'a', ship: null, agent: 'c', status: 'ready', depends: [], blocker: 'none' },
        { id: 'M2', branch: 'b', ship: 's1', agent: 'c', status: 'in-progress', depends: [], blocker: 'none' },
      ],
    });
    const report = analyzeRisk(manifest, { now, knownShips: ['s1', 's2'] });
    expect(report.signals.idleShips).toBe(1); // s2 idle while M1 queued
    expect(report.items.some((i) => i.kind === 'idle-ship-queue')).toBe(true);
  });

  it('flags blocked dependency chains', () => {
    const manifest = makeManifest({
      missions: [
        { id: 'M1', branch: 'a', ship: 's1', agent: 'c', status: 'failed', depends: [], blocker: 'CI failed' },
        { id: 'M2', branch: 'b', ship: null, agent: 'c', status: 'pending', depends: ['M1'], blocker: 'none' },
      ],
    });
    const report = analyzeRisk(manifest, { now });
    expect(report.signals.blockedChains).toBe(1);
    expect(report.items.some((i) => i.kind === 'blocked-chain' && i.missionId === 'M2')).toBe(true);
  });

  it('incorporates stale unapproved batches from the planner layer', () => {
    const report = analyzeRisk(makeManifest(), { now, staleBatches: 2 });
    expect(report.signals.staleBatches).toBe(2);
    expect(report.items.some((i) => i.kind === 'stale-batch')).toBe(true);
  });

  it('escalates level with accumulating risk and sorts high severity first', () => {
    const manifest = makeManifest({
      missions: [
        { id: 'M1', branch: 'a', ship: 's1', agent: 'c', status: 'stalled', depends: [], blocker: '' },
        { id: 'M2', branch: 'b', ship: 's2', agent: 'c', status: 'merge-queued', depends: [], blocker: 'none' },
      ],
      mergeQueue: [{ missionId: 'M2', branch: 'b', ciStatus: 'failed', note: '' }],
    });
    const report = analyzeRisk(manifest, { now });
    expect(report.score).toBeGreaterThan(0);
    expect(['watch', 'at-risk', 'critical']).toContain(report.level);
    expect(report.items[0].severity).toBe('high');
  });

  it('renders a text panel', () => {
    const report = analyzeRisk(makeManifest(), { now });
    const panel = renderRiskPanel(report);
    expect(panel).toContain('Fleet Risk Panel');
    expect(panel).toContain('No risks detected');
  });
});
