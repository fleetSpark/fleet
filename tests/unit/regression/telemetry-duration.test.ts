import { describe, it, expect } from 'vitest';
import { TelemetryCollector } from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';

function makeManifest(mergedDates: Date[]): FleetManifest {
  const now = new Date();
  return {
    updated: now,
    commander: {
      host: 'laptop',
      lastCheckin: now,
      status: 'active',
      timeoutMinutes: 15,
    },
    missions: [],
    mergeQueue: [],
    completed: mergedDates.map((date, i) => ({
      missionId: `M${i + 1}`,
      branch: `feat/m${i + 1}`,
      mergedDate: date,
    })),
  };
}

describe('telemetry avgMissionDurationMin uses merge date spread', () => {
  it('computes duration from spread of merge dates, not current time', () => {
    // Two completed missions: one merged at T=0min, one at T=60min
    const base = new Date('2025-01-01T00:00:00Z');
    const later = new Date('2025-01-01T01:00:00Z'); // 60 minutes later

    const manifest = makeManifest([base, later]);
    const collector = new TelemetryCollector();
    const snap = collector.snapshot(manifest);

    // Spread is 60 minutes across 2 entries = 30 min average
    // If the bug existed (using current time), this would be some huge number
    // based on how far 2025-01-01 is from now
    expect(snap.throughput.avgMissionDurationMin).toBe(30);
  });

  it('returns 0 for fewer than 2 completed entries', () => {
    const manifest = makeManifest([new Date('2025-01-01T00:00:00Z')]);
    const collector = new TelemetryCollector();
    const snap = collector.snapshot(manifest);

    expect(snap.throughput.avgMissionDurationMin).toBe(0);
  });

  it('returns 0 for zero completed entries', () => {
    const manifest = makeManifest([]);
    const collector = new TelemetryCollector();
    const snap = collector.snapshot(manifest);

    expect(snap.throughput.avgMissionDurationMin).toBe(0);
  });

  it('computes correctly with multiple entries', () => {
    // 4 entries spanning 120 minutes total
    const t0 = new Date('2025-06-01T10:00:00Z');
    const t1 = new Date('2025-06-01T10:30:00Z');
    const t2 = new Date('2025-06-01T11:00:00Z');
    const t3 = new Date('2025-06-01T12:00:00Z');

    const manifest = makeManifest([t0, t1, t2, t3]);
    const collector = new TelemetryCollector();
    const snap = collector.snapshot(manifest);

    // Spread = 120 minutes, divided by 4 entries = 30 min average
    expect(snap.throughput.avgMissionDurationMin).toBe(30);
  });

  it('result is stable regardless of when the test runs', () => {
    // This is the key regression check: the value should NOT depend on Date.now()
    const base = new Date('2020-01-01T00:00:00Z');
    const later = new Date('2020-01-01T02:00:00Z'); // 120 min

    const manifest = makeManifest([base, later]);
    const collector = new TelemetryCollector();
    const snap = collector.snapshot(manifest);

    // Spread = 120 min / 2 entries = 60
    expect(snap.throughput.avgMissionDurationMin).toBe(60);

    // Even though these dates are years in the past, the value
    // should be based on the spread between them, not time-since-merge
  });
});
