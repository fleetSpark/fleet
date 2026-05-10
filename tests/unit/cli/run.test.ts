import { describe, it, expect } from 'vitest';
import { topoSort, runSimulate } from '../../../packages/cli/dist/commands/run.js';

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
    expect(ids.indexOf('M1')).toBeLessThan(ids.indexOf('M2'));
    expect(ids.indexOf('M1')).toBeLessThan(ids.indexOf('M3'));
    expect(ids.indexOf('M2')).toBeLessThan(ids.indexOf('M4'));
    expect(ids.indexOf('M3')).toBeLessThan(ids.indexOf('M4'));
    expect(ids).toHaveLength(4);
  });

  it('ignores unknown dependency ids gracefully', () => {
    const m = { id: 'M1', branch: 'b1', brief: 'A', agent: 'claude', depends: ['MISSING'] };
    const result = topoSort([m]);
    expect(result.map((r) => r.id)).toContain('M1');
  });

  it('throws on a direct circular dependency (A depends B, B depends A)', () => {
    const m1 = { id: 'M1', branch: 'b1', brief: 'A', agent: 'claude', depends: ['M2'] };
    const m2 = { id: 'M2', branch: 'b2', brief: 'B', agent: 'claude', depends: ['M1'] };
    expect(() => topoSort([m1, m2])).toThrow(/[Cc]ircular/);
  });

  it('throws on a three-node cycle', () => {
    const m1 = { id: 'M1', branch: 'b1', brief: 'A', agent: 'claude', depends: ['M3'] };
    const m2 = { id: 'M2', branch: 'b2', brief: 'B', agent: 'claude', depends: ['M1'] };
    const m3 = { id: 'M3', branch: 'b3', brief: 'C', agent: 'claude', depends: ['M2'] };
    expect(() => topoSort([m1, m2, m3])).toThrow(/[Cc]ircular/);
  });

  it('does not duplicate missions', () => {
    const m1 = { id: 'M1', branch: 'b1', brief: 'A', agent: 'claude', depends: [] };
    const m2 = { id: 'M2', branch: 'b2', brief: 'B', agent: 'claude', depends: ['M1'] };
    const m3 = { id: 'M3', branch: 'b3', brief: 'C', agent: 'claude', depends: ['M1'] };
    const result = topoSort([m1, m2, m3]);
    const ids = result.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── runSimulate ───────────────────────────────────────────────────────────────

describe('runSimulate', () => {
  it('returns error lines for an unknown template', async () => {
    const lines = await runSimulate('does-not-exist', { delayMs: 0 });
    const text = lines.join('\n');
    expect(text).toContain('Unknown template');
  });

  it('completes without error for test-coverage template', async () => {
    const lines = await runSimulate('test-coverage', { delayMs: 0 });
    expect(lines.length).toBeGreaterThan(0);
  });

  it('contains all mission IDs in output', async () => {
    const lines = await runSimulate('test-coverage', { delayMs: 0 });
    const text = lines.join('\n');
    expect(text).toContain('M1');
    expect(text).toContain('M2');
    expect(text).toContain('M3');
    expect(text).toContain('M4');
  });

  it('shows [simulated] markers throughout', async () => {
    const lines = await runSimulate('test-coverage', { delayMs: 0 });
    const simulatedLines = lines.filter((l) => l.includes('[simulated]') || l.includes('SIMULATE'));
    expect(simulatedLines.length).toBeGreaterThan(0);
  });

  it('shows branch names in summary', async () => {
    const lines = await runSimulate('test-coverage', { delayMs: 0 });
    const text = lines.join('\n');
    expect(text).toContain('feature/test-utils');
    expect(text).toContain('feature/test-ci');
  });

  it('respects agentOverride option', async () => {
    const lines = await runSimulate('test-coverage', { delayMs: 0, agentOverride: 'codex' });
    const text = lines.join('\n');
    expect(text).toContain('codex');
  });

  it('calls emit for each output line', async () => {
    const collected: string[] = [];
    await runSimulate('security-audit', { delayMs: 0, emit: (l) => collected.push(l) });
    expect(collected.length).toBeGreaterThan(0);
  });

  it('shows completion message at end', async () => {
    const lines = await runSimulate('test-coverage', { delayMs: 0 });
    const text = lines.join('\n');
    expect(text).toContain('All 4 missions complete');
  });

  it('outputs missions in topological order for drsti-dev-flow template', async () => {
    const lines = await runSimulate('drsti-dev-flow', { delayMs: 0 });
    const text = lines.join('\n');
    // spec mission must appear before impl mission
    const specIdx = text.indexOf('spec');
    const implIdx = text.indexOf('impl');
    expect(specIdx).toBeLessThan(implIdx);
  });
});
