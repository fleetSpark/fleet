import { describe, it, expect } from 'vitest';
import { meterUsage, priceUsage, DEFAULT_PRICING } from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';

function manifest(): FleetManifest {
  return {
    updated: new Date('2026-06-01T10:00:00Z'),
    commander: { host: 'd', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
    missions: [
      { id: 'M1', branch: 'a', ship: 's1', agent: 'c', status: 'merged', depends: [], blocker: 'none' },
      { id: 'M2', branch: 'b', ship: 's1', agent: 'c', status: 'merged', depends: [], blocker: 'none' },
      { id: 'M3', branch: 'c', ship: 's2', agent: 'c', status: 'failed', depends: [], blocker: 'CI' },
      { id: 'M4', branch: 'd', ship: null, agent: 'c', status: 'in-progress', depends: [], blocker: 'none' },
    ],
    mergeQueue: [],
    completed: [],
  };
}

describe('meterUsage', () => {
  it('derives billable units from the manifest', () => {
    const usage = meterUsage(manifest());
    expect(usage.missions).toBe(4);
    expect(usage.mergedMissions).toBe(2);
    expect(usage.failedMissions).toBe(1);
    expect(usage.ships).toBe(2);
    expect(usage.shipMinutes).toBe(0);
  });

  it('sums supplied ship-minutes', () => {
    const usage = meterUsage(manifest(), { shipMinutes: { s1: 30, s2: 12 } });
    expect(usage.shipMinutes).toBe(42);
  });
});

describe('priceUsage', () => {
  it('prices merged missions and ship-minutes with the default model', () => {
    const usage = meterUsage(manifest(), { shipMinutes: { s1: 100 } });
    const priced = priceUsage(usage);
    expect(priced.currency).toBe('USD');
    // 2 merged * 0.5 + 100 min * 0.01 = 1.0 + 1.0 = 2.0
    expect(priced.total).toBeCloseTo(2.0);
    expect(priced.lineItems).toHaveLength(3);
  });

  it('honors a custom pricing model', () => {
    const usage = meterUsage(manifest());
    const priced = priceUsage(usage, { ...DEFAULT_PRICING, perMergedMission: 1 });
    expect(priced.total).toBeCloseTo(2.0); // 2 merged * 1
  });
});
