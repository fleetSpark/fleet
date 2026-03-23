import { describe, it, expect } from 'vitest';
import { getReadyMissions, validateDAG } from '@fleet/core';
import type { Mission } from '@fleet/core';

function makeMission(overrides: Partial<Mission>): Mission {
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

describe('getReadyMissions', () => {
  it('returns pending missions with no dependencies', () => {
    const missions = [
      makeMission({ id: 'M1', status: 'pending', depends: [] }),
      makeMission({ id: 'M2', status: 'pending', depends: [] }),
    ];
    const ready = getReadyMissions(missions);
    expect(ready.map((m) => m.id)).toEqual(['M1', 'M2']);
  });

  it('returns pending missions whose dependencies are completed', () => {
    const missions = [
      makeMission({ id: 'M1', status: 'completed', depends: [] }),
      makeMission({ id: 'M2', status: 'pending', depends: ['M1'] }),
    ];
    const ready = getReadyMissions(missions);
    expect(ready.map((m) => m.id)).toEqual(['M2']);
  });

  it('returns pending missions whose dependencies are merged', () => {
    const missions = [
      makeMission({ id: 'M1', status: 'merged', depends: [] }),
      makeMission({ id: 'M2', status: 'pending', depends: ['M1'] }),
    ];
    const ready = getReadyMissions(missions);
    expect(ready.map((m) => m.id)).toEqual(['M2']);
  });

  it('does not return missions with incomplete dependencies', () => {
    const missions = [
      makeMission({ id: 'M1', status: 'in-progress', depends: [] }),
      makeMission({ id: 'M2', status: 'pending', depends: ['M1'] }),
    ];
    const ready = getReadyMissions(missions);
    expect(ready).toHaveLength(0);
  });

  it('does not return non-pending missions', () => {
    const missions = [
      makeMission({ id: 'M1', status: 'in-progress', depends: [] }),
    ];
    const ready = getReadyMissions(missions);
    expect(ready).toHaveLength(0);
  });

  // Negative-path: missing dependency reference
  it('does not return mission when dependency ID does not exist', () => {
    const missions = [
      makeMission({ id: 'M2', status: 'pending', depends: ['M_MISSING'] }),
    ];
    const ready = getReadyMissions(missions);
    expect(ready).toHaveLength(0);
  });
});

describe('validateDAG', () => {
  it('validates acyclic graph', () => {
    const missions = [
      makeMission({ id: 'M1', depends: [] }),
      makeMission({ id: 'M2', depends: ['M1'] }),
      makeMission({ id: 'M3', depends: ['M1'] }),
    ];
    const result = validateDAG(missions);
    expect(result.valid).toBe(true);
  });

  it('detects circular dependency', () => {
    const missions = [
      makeMission({ id: 'M1', depends: ['M2'] }),
      makeMission({ id: 'M2', depends: ['M1'] }),
    ];
    const result = validateDAG(missions);
    expect(result.valid).toBe(false);
    expect(result.cycles).toBeDefined();
  });

  it('detects self-dependency', () => {
    const missions = [makeMission({ id: 'M1', depends: ['M1'] })];
    const result = validateDAG(missions);
    expect(result.valid).toBe(false);
  });

  it('validates empty mission list', () => {
    const result = validateDAG([]);
    expect(result.valid).toBe(true);
  });
});
