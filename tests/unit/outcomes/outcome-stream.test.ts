import { describe, it, expect } from 'vitest';
import {
  classifyOutcomes,
  summarizeOutcomes,
  generateOutcomesJson,
  renderOutcomes,
} from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';

function makeManifest(overrides: Partial<FleetManifest> = {}): FleetManifest {
  return {
    updated: new Date('2026-06-01T10:00:00Z'),
    commander: {
      host: 'dev',
      lastCheckin: new Date('2026-06-01T10:00:00Z'),
      status: 'active',
      timeoutMinutes: 15,
    },
    missions: [
      { id: 'M1', branch: 'feat/a', ship: 'ship-1', agent: 'claude', status: 'merged', depends: [], blocker: 'none' },
      { id: 'M2', branch: 'feat/b', ship: 'ship-2', agent: 'codex', status: 'failed', depends: [], blocker: 'CI failed' },
      { id: 'M3', branch: 'feat/c', ship: 'ship-3', agent: 'aider', status: 'stalled', depends: [], blocker: 'Ship unresponsive' },
      { id: 'M4', branch: 'feat/d', ship: null, agent: 'claude', status: 'pending', depends: ['M1'], blocker: 'none' },
      { id: 'M5', branch: 'feat/e', ship: 'ship-1', agent: 'claude', status: 'in-progress', depends: [], blocker: 'none' },
      { id: 'M6', branch: 'feat/f', ship: null, agent: 'claude', status: 'blocked', depends: [], blocker: 'Merge conflict' },
    ],
    mergeQueue: [],
    completed: [
      { missionId: 'M1', branch: 'feat/a', mergedDate: new Date('2026-06-01T11:00:00Z') },
    ],
    ...overrides,
  };
}

describe('classifyOutcomes', () => {
  it('maps each mission status to an outcome kind', () => {
    const outcomes = classifyOutcomes(makeManifest());
    const byId = Object.fromEntries(outcomes.map((o) => [o.missionId, o]));
    expect(byId.M1.kind).toBe('merged');
    expect(byId.M2.kind).toBe('failed');
    expect(byId.M3.kind).toBe('stalled');
    expect(byId.M4.kind).toBe('pending');
    expect(byId.M5.kind).toBe('in-progress');
    expect(byId.M6.kind).toBe('blocked');
  });

  it('marks merged and failed as terminal', () => {
    const outcomes = classifyOutcomes(makeManifest());
    const byId = Object.fromEntries(outcomes.map((o) => [o.missionId, o]));
    expect(byId.M1.terminal).toBe(true);
    expect(byId.M2.terminal).toBe(true);
    expect(byId.M3.terminal).toBe(false);
    expect(byId.M5.terminal).toBe(false);
  });

  it('attaches merge date for merged missions', () => {
    const byId = Object.fromEntries(classifyOutcomes(makeManifest()).map((o) => [o.missionId, o]));
    expect(byId.M1.at).toBe('2026-06-01T11:00:00.000Z');
    expect(byId.M5.at).toBeNull();
  });

  it('normalizes "none" blocker to empty string', () => {
    const byId = Object.fromEntries(classifyOutcomes(makeManifest()).map((o) => [o.missionId, o]));
    expect(byId.M1.blocker).toBe('');
    expect(byId.M2.blocker).toBe('CI failed');
  });
});

describe('summarizeOutcomes', () => {
  it('counts each kind', () => {
    const summary = summarizeOutcomes(classifyOutcomes(makeManifest()));
    expect(summary.total).toBe(6);
    expect(summary.merged).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.stalled).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.pending).toBe(1);
  });

  it('flags a run with failures/stalls as not clean', () => {
    const summary = summarizeOutcomes(classifyOutcomes(makeManifest()));
    expect(summary.cleanRun).toBe(false);
    expect(summary.complete).toBe(false);
  });

  it('flags a clean, complete run when all missions terminal and none failed', () => {
    const manifest = makeManifest({
      missions: [
        { id: 'M1', branch: 'feat/a', ship: 'ship-1', agent: 'claude', status: 'merged', depends: [], blocker: 'none' },
        { id: 'M2', branch: 'feat/b', ship: 'ship-2', agent: 'claude', status: 'merged', depends: [], blocker: 'none' },
      ],
    });
    const summary = summarizeOutcomes(classifyOutcomes(manifest));
    expect(summary.cleanRun).toBe(true);
    expect(summary.complete).toBe(true);
  });

  it('treats empty manifest as not complete', () => {
    const summary = summarizeOutcomes([]);
    expect(summary.complete).toBe(false);
    expect(summary.cleanRun).toBe(true);
  });
});

describe('generateOutcomesJson / renderOutcomes', () => {
  it('produces JSON with summary and outcomes', () => {
    const json = generateOutcomesJson(makeManifest());
    expect(json.summary.total).toBe(6);
    expect(json.outcomes).toHaveLength(6);
    expect(typeof json.generatedAt).toBe('string');
  });

  it('renders a readable text block', () => {
    const text = renderOutcomes(makeManifest());
    expect(text).toContain('Mission Outcomes');
    expect(text).toContain('M1');
    expect(text).toContain('merged');
    expect(text).toContain('needs attention');
  });

  it('handles an empty mission list', () => {
    const text = renderOutcomes(makeManifest({ missions: [], completed: [] }));
    expect(text).toContain('(no missions)');
  });
});
