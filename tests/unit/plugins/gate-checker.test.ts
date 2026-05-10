import { describe, it, expect } from 'vitest';
import {
  checkSpecGate,
  checkCodeGate,
  checkMergeGate,
  inferMissionPhase,
} from '../../../packages/plugin-drsti-dev-flow/src/gate-checker.js';
import type { Workstream } from '../../../packages/plugin-drsti-dev-flow/src/workstream.js';

const emptyGate = { artifact: null, self_review: null, peer_review: null };
const partialGate = { artifact: 'docs/spec.md', self_review: 'clean', peer_review: null };
const fullGate = { artifact: 'docs/spec.md', self_review: 'clean', peer_review: 'approved' };

function makeWs(overrides: Partial<Workstream> = {}): Workstream {
  return {
    id: 'ws-test',
    branch: 'feature/test-impl',
    status: 'in-progress',
    phase: 'implement',
    maturity_level: '3',
    merge_gate: 'not_ready',
    review_gate: {
      spec: emptyGate,
      plan: emptyGate,
      code: emptyGate,
      tests_uat: null,
    },
    ...overrides,
  };
}

// ── inferMissionPhase ─────────────────────────────────────────────────────────

describe('inferMissionPhase', () => {
  it('detects spec branches', () => {
    expect(inferMissionPhase('feature/oauth-spec')).toBe('spec');
    expect(inferMissionPhase('feature/governed-spec')).toBe('spec');
  });

  it('detects impl branches', () => {
    expect(inferMissionPhase('feature/oauth-impl')).toBe('impl');
  });

  it('detects review branches', () => {
    expect(inferMissionPhase('feature/oauth-review')).toBe('review');
    expect(inferMissionPhase('feature/governed-review')).toBe('review');
  });

  it('returns unknown for unrecognised branches', () => {
    expect(inferMissionPhase('feature/add-oauth')).toBe('unknown');
    expect(inferMissionPhase('fix/rate-limiter')).toBe('unknown');
  });
});

// ── checkSpecGate ─────────────────────────────────────────────────────────────

describe('checkSpecGate', () => {
  it('passes for L1/L2 regardless of gate state', () => {
    expect(checkSpecGate(makeWs({ maturity_level: '1' })).passed).toBe(true);
    expect(checkSpecGate(makeWs({ maturity_level: '2' })).passed).toBe(true);
  });

  it('blocks L3 when spec artifact is missing', () => {
    const result = checkSpecGate(makeWs({ maturity_level: '3' }));
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/spec artifact/);
  });

  it('blocks L3 when self_review is missing', () => {
    const ws = makeWs({
      maturity_level: '3',
      review_gate: { spec: { artifact: 'docs/spec.md', self_review: null, peer_review: null }, plan: emptyGate, code: emptyGate, tests_uat: null },
    });
    const result = checkSpecGate(ws);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/self-review/);
  });

  it('passes L3 when artifact + self_review set (peer_review not required)', () => {
    const ws = makeWs({
      maturity_level: '3',
      review_gate: { spec: partialGate, plan: emptyGate, code: emptyGate, tests_uat: null },
    });
    expect(checkSpecGate(ws).passed).toBe(true);
  });

  it('blocks L4 when peer_review is missing', () => {
    const ws = makeWs({
      maturity_level: '4',
      review_gate: { spec: partialGate, plan: emptyGate, code: emptyGate, tests_uat: null },
    });
    const result = checkSpecGate(ws);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/peer-review/);
  });

  it('passes L4 when all three fields are set', () => {
    const ws = makeWs({
      maturity_level: '4',
      review_gate: { spec: fullGate, plan: emptyGate, code: emptyGate, tests_uat: null },
    });
    expect(checkSpecGate(ws).passed).toBe(true);
  });
});

// ── checkCodeGate ─────────────────────────────────────────────────────────────

describe('checkCodeGate', () => {
  it('passes for L1/L2', () => {
    expect(checkCodeGate(makeWs({ maturity_level: '1' })).passed).toBe(true);
  });

  it('blocks L3 when code artifact is missing', () => {
    expect(checkCodeGate(makeWs({ maturity_level: '3' })).passed).toBe(false);
  });

  it('passes L3 with artifact + self_review', () => {
    const ws = makeWs({
      maturity_level: '3',
      review_gate: { spec: emptyGate, plan: emptyGate, code: partialGate, tests_uat: null },
    });
    expect(checkCodeGate(ws).passed).toBe(true);
  });
});

// ── checkMergeGate ────────────────────────────────────────────────────────────

describe('checkMergeGate', () => {
  it('passes for L1/L2 regardless of merge_gate value', () => {
    expect(checkMergeGate(makeWs({ maturity_level: '1', merge_gate: 'not_ready' })).passed).toBe(true);
  });

  it('blocks L3 when merge_gate is not_ready', () => {
    const result = checkMergeGate(makeWs({ maturity_level: '3', merge_gate: 'not_ready' }));
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/merge_gate/);
  });

  it('passes L3 when merge_gate is ready', () => {
    expect(checkMergeGate(makeWs({ maturity_level: '3', merge_gate: 'ready' })).passed).toBe(true);
  });

  it('blocks L4 when merge_gate is ready but gate fields are incomplete', () => {
    const ws = makeWs({
      maturity_level: '4',
      merge_gate: 'ready',
      review_gate: { spec: partialGate, plan: emptyGate, code: partialGate, tests_uat: null },
    });
    const result = checkMergeGate(ws);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/L4/);
  });

  it('passes L4 when merge_gate is ready and all gate fields are populated', () => {
    const ws = makeWs({
      maturity_level: '4',
      merge_gate: 'ready',
      review_gate: { spec: fullGate, plan: fullGate, code: fullGate, tests_uat: null },
    });
    expect(checkMergeGate(ws).passed).toBe(true);
  });
});
