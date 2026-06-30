import { describe, it, expect } from 'vitest';
import { applyReplay } from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';

function makeManifest(): FleetManifest {
  return {
    updated: new Date('2026-06-01T10:00:00Z'),
    commander: { host: 'd', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
    missions: [
      { id: 'M1', branch: 'feat/a', ship: 'ship-1', agent: 'claude', status: 'failed', depends: [], blocker: 'CI failed' },
      { id: 'M2', branch: 'feat/b', ship: 'ship-2', agent: 'claude', status: 'merged', depends: ['M1'], blocker: 'none' },
    ],
    mergeQueue: [{ missionId: 'M1', branch: 'feat/a', ciStatus: 'failed', note: '' }],
    completed: [{ missionId: 'M2', branch: 'feat/b', mergedDate: new Date('2026-06-01T11:00:00Z') }],
  };
}

describe('applyReplay', () => {
  it('resets a failed mission with no deps to ready', () => {
    const manifest = makeManifest();
    const r = applyReplay(manifest, 'M1');
    expect(r.ok).toBe(true);
    expect(r.mission!.status).toBe('ready');
    expect(r.mission!.ship).toBeNull();
    expect(r.mission!.blocker).toBe('none');
  });

  it('resets a dependent mission to pending', () => {
    const manifest = makeManifest();
    const r = applyReplay(manifest, 'M2');
    expect(r.ok).toBe(true);
    expect(r.mission!.status).toBe('pending');
  });

  it('clears merge-queue and completed records for the mission', () => {
    const manifest = makeManifest();
    applyReplay(manifest, 'M1');
    expect(manifest.mergeQueue.find((e) => e.missionId === 'M1')).toBeUndefined();
    applyReplay(manifest, 'M2');
    expect(manifest.completed.find((c) => c.missionId === 'M2')).toBeUndefined();
  });

  it('returns an error for an unknown mission', () => {
    const r = applyReplay(makeManifest(), 'MX');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('not found');
  });
});
