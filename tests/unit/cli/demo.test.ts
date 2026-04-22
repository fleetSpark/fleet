import { describe, it, expect } from 'vitest';
import { runDemo } from '../../../packages/cli/dist/commands/demo.js';

describe('fleet demo', () => {
  it('completes without error', async () => {
    const output = await runDemo(() => {}, 0);
    expect(output.length).toBeGreaterThan(0);
  });

  it('includes all 4 mission IDs', async () => {
    const output = await runDemo(() => {}, 0);
    const text = output.join('\n');
    expect(text).toContain('M1');
    expect(text).toContain('M2');
    expect(text).toContain('M3');
    expect(text).toContain('M4');
  });

  it('includes "fleetspark init" in next steps', async () => {
    const output = await runDemo(() => {}, 0);
    const text = output.join('\n');
    expect(text).toContain('fleetspark init');
  });
});
