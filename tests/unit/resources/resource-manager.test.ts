import { describe, it, expect } from 'vitest';
import { ResourceManager } from '../../../packages/core/dist/resources/resource-manager.js';
import type { FleetManifest, Mission } from '../../../packages/core/dist/index.js';

function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'M1',
    branch: 'feature/test',
    ship: null,
    agent: 'claude-code',
    status: 'pending',
    depends: [],
    blocker: 'none',
    ...overrides,
  };
}

function makeManifest(missions: Mission[]): FleetManifest {
  return {
    updated: new Date(),
    commander: { host: 'test', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
    missions,
    mergeQueue: [],
    completed: [],
  };
}

describe('ResourceManager', () => {
  it('allows assignment when within limits', () => {
    const rm = new ResourceManager({ maxMissionsPerShip: 2, maxConcurrentShips: 8, missionTimeoutMin: 120 });
    const manifest = makeManifest([
      makeMission({ id: 'M1', ship: 'ship-a', status: 'in-progress' }),
    ]);

    const result = rm.canAssignMission('ship-a', manifest);
    expect(result.allowed).toBe(true);
  });

  it('denies when ship at per-ship limit', () => {
    const rm = new ResourceManager({ maxMissionsPerShip: 1, maxConcurrentShips: 8, missionTimeoutMin: 120 });
    const manifest = makeManifest([
      makeMission({ id: 'M1', ship: 'ship-a', status: 'in-progress' }),
    ]);

    const result = rm.canAssignMission('ship-a', manifest);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('ship-a');
  });

  it('denies when global ship count at limit', () => {
    const rm = new ResourceManager({ maxMissionsPerShip: 2, maxConcurrentShips: 2, missionTimeoutMin: 120 });
    const manifest = makeManifest([
      makeMission({ id: 'M1', ship: 'ship-a', status: 'in-progress' }),
      makeMission({ id: 'M2', ship: 'ship-b', status: 'in-progress' }),
    ]);

    const result = rm.canAssignMission('ship-c', manifest);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('max concurrent');
  });

  it('allows existing ship even when at global limit', () => {
    const rm = new ResourceManager({ maxMissionsPerShip: 2, maxConcurrentShips: 2, missionTimeoutMin: 120 });
    const manifest = makeManifest([
      makeMission({ id: 'M1', ship: 'ship-a', status: 'in-progress' }),
      makeMission({ id: 'M2', ship: 'ship-b', status: 'in-progress' }),
    ]);

    const result = rm.canAssignMission('ship-a', manifest);
    expect(result.allowed).toBe(true);
  });

  it('returns timed out missions', () => {
    const rm = new ResourceManager({ maxMissionsPerShip: 1, maxConcurrentShips: 8, missionTimeoutMin: 60 });
    const oldDate = new Date(Date.now() - 90 * 60 * 1000); // 90 min ago
    const manifest = makeManifest([
      makeMission({ id: 'M1', ship: 'ship-a', status: 'in-progress' }),
    ]);
    manifest.updated = oldDate;

    const timedOut = rm.getTimedOutMissions(manifest);
    expect(timedOut).toHaveLength(1);
    expect(timedOut[0].id).toBe('M1');
  });

  it('ignores non-in-progress missions for timeout', () => {
    const rm = new ResourceManager({ maxMissionsPerShip: 1, maxConcurrentShips: 8, missionTimeoutMin: 60 });
    const oldDate = new Date(Date.now() - 90 * 60 * 1000);
    const manifest = makeManifest([
      makeMission({ id: 'M1', status: 'completed' }),
    ]);
    manifest.updated = oldDate;

    const timedOut = rm.getTimedOutMissions(manifest);
    expect(timedOut).toHaveLength(0);
  });
});
