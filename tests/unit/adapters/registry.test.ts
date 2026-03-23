import { describe, it, expect } from 'vitest';
import { resolveAdapter } from '@fleetspark/core';

describe('resolveAdapter', () => {
  it('throws helpful error for missing adapter', async () => {
    await expect(resolveAdapter('nonexistent-adapter')).rejects.toThrow('not found');
  });

  it('resolves claude-code adapter', async () => {
    const adapter = await resolveAdapter('claude-code');
    expect(adapter.name).toBe('claude-code');
    expect(typeof adapter.start).toBe('function');
  });
});
