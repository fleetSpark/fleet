import { describe, it, expect } from 'vitest';
import { topoSort } from '../../../packages/cli/dist/commands/run.js';

// ── topoSort ──────────────────────────────────────────────────────────────────

describe('topoSort', () => {
  it('returns an empty array for no missions', () => {
    expect(topoSort([])).toEqual([]);
  });

  it('returns single mission unchanged', () => {
    const m = { id: 'M1', branch: 'feature/test', brief: 'Do stuff', agent: 'claude', depends: [] };
    expect(topoSort([m])).toEqual([m]);
  });

  it('places dependency before dependent', () => {
    const m1 = { id: 'M1', branch: 'b1', brief: 'A', agent: 'claude', depends: [] };
    const m2 = { id: 'M2', branch: 'b2', brief: 'B', agent: 'claude', depends: ['M1'] };
    const result = topoSort([m2, m1]); // intentionally reversed input
    const ids = result.map((m) => m.id);
    expect(ids.indexOf('M1')).toBeLessThan(ids.indexOf('M2'));
  });

  it('handles a linear chain of three missions', () => {
    const m1 = { id: 'M1', branch: 'b1', brief: 'A', agent: 'claude', depends: [] };
    const m2 = { id: 'M2', branch: 'b2', brief: 'B', agent: 'claude', depends: ['M1'] };
    const m3 = { id: 'M3', branch: 'b3', brief: 'C', agent: 'claude', depends: ['M2'] };
    const result = topoSort([m3, m1, m2]);
    const ids = result.map((m) => m.id);
    expect(ids).toEqual(['M1', 'M2', 'M3']);
  });

  it('handles a diamond dependency graph', () => {
    // M1 → M2, M3 → M4
    const m1 = { id: 'M1', branch: 'b1', brief: 'A', agent: 'claude', depends: [] };
    const m2 = { id: 'M2', branch: 'b2', brief: 'B', agent: 'claude', depends: ['M1'] };
    const m3 = { id: 'M3', branch: 'b3', brief: 'C', agent: 'claude', depends: ['M1'] };
    const m4 = { id: 'M4', branch: 'b4', brief: 'D', agent: 'claude', depends: ['M2', 'M3'] };
    const result = topoSort([m4, m3, m2, m1]);
    const ids = result.map((m) => m.id);
    // M1 must come before M2, M3; M2 and M3 must come before M4
    expect(ids.indexOf('M1')).toBeLessThan(ids.indexOf('M2'));
    expect(ids.indexOf('M1')).toBeLessThan(ids.indexOf('M3'));
    expect(ids.indexOf('M2')).toBeLessThan(ids.indexOf('M4'));
    expect(ids.indexOf('M3')).toBeLessThan(ids.indexOf('M4'));
    expect(ids).toHaveLength(4);
  });

  it('ignores unknown dependency ids gracefully', () => {
    const m = { id: 'M1', branch: 'b1', brief: 'A', agent: 'claude', depends: ['MISSING'] };
    // Should not throw — just skips unresolved deps
    const result = topoSort([m]);
    expect(result.map((r) => r.id)).toContain('M1');
  });

  it('does not duplicate missions', () => {
    const m1 = { id: 'M1', branch: 'b1', brief: 'A', agent: 'claude', depends: [] };
    const m2 = { id: 'M2', branch: 'b2', brief: 'B', agent: 'claude', depends: ['M1'] };
    const m3 = { id: 'M3', branch: 'b3', brief: 'C', agent: 'claude', depends: ['M1'] };
    const result = topoSort([m1, m2, m3]);
    const ids = result.map((r) => r.id);
    // Each id should appear exactly once
    expect(new Set(ids).size).toBe(ids.length);
  });
});
