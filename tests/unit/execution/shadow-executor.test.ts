import { describe, it, expect } from 'vitest';
import { ShadowExecutor } from '@fleetspark/core';
import type { Mission } from '@fleetspark/core';

const mission = (overrides: Partial<Mission> = {}): Mission => ({
  id: 'M1',
  branch: 'feat/a',
  ship: 'ship-primary',
  agent: 'claude',
  status: 'stalled',
  depends: [],
  blocker: 'Ship unresponsive',
  ...overrides,
});

describe('ShadowExecutor.selectSpareShip', () => {
  const ex = new ShadowExecutor();
  it('returns the first non-busy ship', () => {
    expect(ex.selectSpareShip(['s1', 's2', 's3'], ['s1'])).toBe('s2');
  });
  it('excludes the primary ship', () => {
    expect(ex.selectSpareShip(['s1', 's2'], [], 's1')).toBe('s2');
  });
  it('returns null when all ships are busy', () => {
    expect(ex.selectSpareShip(['s1', 's2'], ['s1', 's2'])).toBeNull();
  });
});

describe('ShadowExecutor.planShadow', () => {
  const ex = new ShadowExecutor();
  it('creates an isolated shadow branch on a spare ship', () => {
    const plan = ex.planShadow(mission(), ['ship-primary', 'ship-spare'], ['ship-primary']);
    expect(plan).not.toBeNull();
    expect(plan!.shadowShip).toBe('ship-spare');
    expect(plan!.primaryShip).toBe('ship-primary');
    expect(plan!.shadowBranch).toBe('feat/a-shadow-ship-spare');
  });
  it('returns null when no spare ship is available', () => {
    const plan = ex.planShadow(mission(), ['ship-primary'], ['ship-primary']);
    expect(plan).toBeNull();
  });
});

describe('ShadowExecutor.resolveFirstCompleted', () => {
  const ex = new ShadowExecutor();
  const assignment = {
    missionId: 'M1',
    primaryShip: 'ship-primary',
    shadowShip: 'ship-spare',
    shadowBranch: 'feat/a-shadow-ship-spare',
  };

  it('is pending while neither copy is complete', () => {
    const r = ex.resolveFirstCompleted(assignment, 'in-progress', 'in-progress');
    expect(r.winner).toBe('pending');
    expect(r.cancelShip).toBeNull();
  });

  it('accepts the shadow and cancels the primary when only shadow completes', () => {
    const r = ex.resolveFirstCompleted(assignment, 'in-progress', 'completed');
    expect(r.winner).toBe('shadow');
    expect(r.cancelShip).toBe('ship-primary');
  });

  it('accepts the primary and cancels the shadow when only primary completes', () => {
    const r = ex.resolveFirstCompleted(assignment, 'merged', 'in-progress');
    expect(r.winner).toBe('primary');
    expect(r.cancelShip).toBe('ship-spare');
  });

  it('prefers primary on a tie by default, shadow when biased', () => {
    expect(ex.resolveFirstCompleted(assignment, 'completed', 'completed').winner).toBe('primary');
    expect(ex.resolveFirstCompleted(assignment, 'completed', 'completed', true).winner).toBe('shadow');
  });
});
