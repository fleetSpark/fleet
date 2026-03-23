import { describe, it, expect } from 'vitest';
import { ResourceManager } from '@fleet/core';
import type { FleetManifest } from '@fleet/core';

function makeManifest(updatedDate: Date): FleetManifest {
  return {
    updated: updatedDate,
    commander: {
      host: 'laptop',
      lastCheckin: updatedDate,
      status: 'active',
      timeoutMinutes: 15,
    },
    missions: [
      {
        id: 'M1',
        branch: 'feat/a',
        ship: 'ship1',
        agent: 'claude',
        status: 'in-progress',
        depends: [],
        blocker: 'none',
      },
      {
        id: 'M2',
        branch: 'feat/b',
        ship: 'ship2',
        agent: 'claude',
        status: 'in-progress',
        depends: [],
        blocker: 'none',
      },
      {
        id: 'M3',
        branch: 'feat/c',
        ship: 'ship3',
        agent: 'claude',
        status: 'in-progress',
        depends: [],
        blocker: 'none',
      },
    ],
    mergeQueue: [],
    completed: [],
  };
}

describe('ResourceManager uses per-mission heartbeat timestamps', () => {
  const config = {
    maxMissionsPerShip: 3,
    maxConcurrentShips: 10,
    missionTimeoutMin: 30,
  };

  it('uses per-mission heartbeat timestamps instead of manifest.updated', () => {
    const now = new Date();
    // manifest.updated is recent (just now) -- without per-mission timestamps,
    // no missions would appear timed out
    const manifest = makeManifest(now);

    const rm = new ResourceManager(config);

    // Without heartbeat timestamps, nothing should be timed out
    // (manifest.updated is recent)
    const timedOutWithoutTimestamps = rm.getTimedOutMissions(manifest, now);
    expect(timedOutWithoutTimestamps).toHaveLength(0);

    // Now provide per-mission heartbeat timestamps where M1 and M3 are old
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const heartbeatTimestamps = new Map<string, Date>([
      ['M1', twoHoursAgo],  // old -- should be timed out
      ['M2', now],           // recent -- should NOT be timed out
      ['M3', twoHoursAgo],  // old -- should be timed out
    ]);

    const timedOut = rm.getTimedOutMissions(manifest, now, heartbeatTimestamps);
    expect(timedOut).toHaveLength(2);

    const timedOutIds = timedOut.map((m) => m.id).sort();
    expect(timedOutIds).toEqual(['M1', 'M3']);
  });

  it('falls back to manifest.updated when no heartbeat timestamp for a mission', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // manifest.updated is old
    const manifest = makeManifest(oneHourAgo);

    const rm = new ResourceManager(config);

    // Only provide heartbeat for M1 (recent), M2 and M3 fall back to manifest.updated
    const heartbeatTimestamps = new Map<string, Date>([
      ['M1', now], // recent
    ]);

    const timedOut = rm.getTimedOutMissions(manifest, now, heartbeatTimestamps);
    const timedOutIds = timedOut.map((m) => m.id).sort();
    expect(timedOutIds).toEqual(['M2', 'M3']);
  });

  it('returns empty when all missions have recent heartbeats', () => {
    const now = new Date();
    const manifest = makeManifest(new Date(0)); // very old manifest.updated

    const rm = new ResourceManager(config);

    const heartbeatTimestamps = new Map<string, Date>([
      ['M1', now],
      ['M2', now],
      ['M3', now],
    ]);

    const timedOut = rm.getTimedOutMissions(manifest, now, heartbeatTimestamps);
    expect(timedOut).toHaveLength(0);
  });

  it('ignores non-in-progress missions even with old heartbeats', () => {
    const now = new Date();
    const manifest = makeManifest(now);
    // Change M2 to completed status
    manifest.missions[1].status = 'completed';

    const rm = new ResourceManager(config);

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const heartbeatTimestamps = new Map<string, Date>([
      ['M1', twoHoursAgo],
      ['M2', twoHoursAgo], // old but not in-progress, should be ignored
      ['M3', now],
    ]);

    const timedOut = rm.getTimedOutMissions(manifest, now, heartbeatTimestamps);
    expect(timedOut).toHaveLength(1);
    expect(timedOut[0].id).toBe('M1');
  });
});
