import { describe, it, expect } from 'vitest';
import { TelemetryCollector } from '../../../packages/core/dist/telemetry/telemetry.js';
import type { TelemetrySnapshot } from '../../../packages/core/dist/telemetry/telemetry.js';

function makeManifest(overrides: Record<string, unknown> = {}) {
  return {
    updated: new Date('2026-03-23T10:00:00Z'),
    commander: {
      host: 'dev-machine',
      lastCheckin: new Date(),
      status: 'active' as const,
      timeoutMinutes: 30,
    },
    missions: [
      { id: 'M1', branch: 'feat/a', ship: 'ship-1', agent: 'claude', status: 'in-progress' as const, depends: [], blocker: '' },
      { id: 'M2', branch: 'feat/b', ship: 'ship-2', agent: 'claude', status: 'pending' as const, depends: [], blocker: '' },
      { id: 'M3', branch: 'feat/c', ship: 'ship-1', agent: 'claude', status: 'completed' as const, depends: [], blocker: '' },
      { id: 'M4', branch: 'feat/d', ship: 'ship-3', agent: 'claude', status: 'failed' as const, depends: [], blocker: '' },
      { id: 'M5', branch: 'feat/e', ship: null, agent: 'claude', status: 'merged' as const, depends: [], blocker: '' },
    ],
    mergeQueue: [],
    completed: [
      { missionId: 'M5', branch: 'feat/e', mergedDate: new Date('2026-03-23T11:00:00Z') },
    ],
    ...overrides,
  };
}

describe('TelemetryCollector', () => {
  it('snapshot counts mission statuses correctly', () => {
    const collector = new TelemetryCollector();
    const manifest = makeManifest();
    const snap = collector.snapshot(manifest);

    expect(snap.missions.total).toBe(5);
    expect(snap.missions.pending).toBe(1);    // M2 (pending)
    expect(snap.missions.inProgress).toBe(1); // M1 (in-progress)
    expect(snap.missions.completed).toBe(1);  // M3
    expect(snap.missions.failed).toBe(1);     // M4
    expect(snap.missions.merged).toBe(1);     // M5
  });

  it('snapshot calculates ship utilization', () => {
    const collector = new TelemetryCollector();
    const manifest = makeManifest();
    const snap = collector.snapshot(manifest);

    // ship-1 is active (M1 in-progress), ship-2 is idle (M2 pending), ship-3 is idle (M4 failed)
    // M5 has ship=null so not counted
    expect(snap.ships.active).toBe(1);  // ship-1
    expect(snap.ships.idle).toBe(2);    // ship-2, ship-3
    expect(snap.ships.utilizationPct).toBeCloseTo(33.33, 1);
  });

  it('history is maintained up to maxHistory', () => {
    const collector = new TelemetryCollector(3);
    const manifest = makeManifest();

    collector.snapshot(manifest);
    collector.snapshot(manifest);
    collector.snapshot(manifest);
    collector.snapshot(manifest);
    collector.snapshot(manifest);

    const history = collector.getHistory();
    expect(history.length).toBe(3);
  });

  it('summary returns readable string', () => {
    const collector = new TelemetryCollector();
    const manifest = makeManifest();
    collector.snapshot(manifest);

    const text = collector.summary();
    expect(text).toContain('Fleet Telemetry');
    expect(text).toContain('Missions:');
    expect(text).toContain('Total: 5');
    expect(text).toContain('Ships:');
    expect(text).toContain('Utilization:');
    expect(text).toContain('Throughput:');
  });

  it('summary reports no data when history is empty', () => {
    const collector = new TelemetryCollector();
    expect(collector.summary()).toBe('No telemetry data collected yet.');
  });

  it('getHistory returns a copy', () => {
    const collector = new TelemetryCollector();
    const manifest = makeManifest();
    collector.snapshot(manifest);

    const h1 = collector.getHistory();
    const h2 = collector.getHistory();
    expect(h1).not.toBe(h2);
    expect(h1).toEqual(h2);
  });
});
