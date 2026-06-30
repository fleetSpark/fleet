import { describe, it, expect } from 'vitest';
import {
  validateBatchBlock,
  loadBatchBlock,
  registerPlanSource,
  resolvePlanSource,
} from '@fleetspark/core';
import type { BatchBlock } from '@fleetspark/core';

function goodBlock(overrides: Partial<BatchBlock> = {}): BatchBlock {
  return {
    source: 'pm-agent',
    approved: true,
    conflictChecked: true,
    missions: [
      { id: 'M1', branch: 'feat/a', brief: 'Do A' },
      { id: 'M2', branch: 'feat/b', brief: 'Do B', depends: ['M1'] },
    ],
    ...overrides,
  };
}

describe('validateBatchBlock', () => {
  it('accepts an approved, conflict-checked, acyclic block', () => {
    const r = validateBatchBlock(goodBlock());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects an unapproved block', () => {
    const r = validateBatchBlock(goodBlock({ approved: false }));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('not approved');
  });

  it('rejects a block that was not conflict-checked', () => {
    const r = validateBatchBlock(goodBlock({ conflictChecked: false }));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('conflict-checked');
  });

  it('rejects an empty mission list', () => {
    const r = validateBatchBlock(goodBlock({ missions: [] }));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('no missions');
  });

  it('rejects duplicate mission ids', () => {
    const r = validateBatchBlock(
      goodBlock({
        missions: [
          { id: 'M1', branch: 'feat/a', brief: 'A' },
          { id: 'M1', branch: 'feat/b', brief: 'B' },
        ],
      }),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('Duplicate');
  });

  it('rejects unknown dependency references', () => {
    const r = validateBatchBlock(
      goodBlock({ missions: [{ id: 'M1', branch: 'feat/a', brief: 'A', depends: ['MX'] }] }),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('unknown mission "MX"');
  });

  it('rejects a circular dependency', () => {
    const r = validateBatchBlock(
      goodBlock({
        missions: [
          { id: 'M1', branch: 'feat/a', brief: 'A', depends: ['M2'] },
          { id: 'M2', branch: 'feat/b', brief: 'B', depends: ['M1'] },
        ],
      }),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('Circular');
  });

  it('rejects a mission missing required fields', () => {
    const r = validateBatchBlock(
      goodBlock({ missions: [{ id: 'M1', branch: '', brief: 'A' } as any] }),
    );
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('missing required field');
  });
});

describe('loadBatchBlock', () => {
  it('loads and coerces a JSON batch file', async () => {
    const json = JSON.stringify({ source: 'file', approved: true, conflictChecked: true, missions: [{ id: 'M1', branch: 'b', brief: 'x' }] });
    const block = await loadBatchBlock('batch.json', { readFile: async () => json });
    expect(block.source).toBe('file');
    expect(block.approved).toBe(true);
    expect(block.missions).toHaveLength(1);
  });

  it('coerces missing approval flags to false', async () => {
    const json = JSON.stringify({ missions: [] });
    const block = await loadBatchBlock('batch.json', { readFile: async () => json });
    expect(block.approved).toBe(false);
    expect(block.conflictChecked).toBe(false);
  });

  it('parses a YAML batch file via injected parser', async () => {
    const yaml = 'irrelevant';
    const block = await loadBatchBlock('batch.yml', {
      readFile: async () => yaml,
      parseYaml: () => ({ source: 'y', approved: true, conflictChecked: true, missions: [{ id: 'M1', branch: 'b', brief: 'x' }] }),
    });
    expect(block.source).toBe('y');
  });

  it('resolves a registered named plan source', async () => {
    registerPlanSource('test-source', () => ({
      name: 'test-source',
      fetch: async () => goodBlock({ source: 'test-source' }),
    }));
    expect(resolvePlanSource('test-source')).not.toBeNull();
    const block = await loadBatchBlock('test-source');
    expect(block.source).toBe('test-source');
  });

  it('throws on an unknown non-file source', async () => {
    await expect(loadBatchBlock('does-not-exist')).rejects.toThrow('Unknown plan source');
  });
});
