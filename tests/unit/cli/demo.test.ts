import { describe, it, expect } from 'vitest';
import { runDemo, runBenchmark } from '../../../packages/cli/dist/commands/demo.js';

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

describe('fleet demo --benchmark', () => {
  function captureLog(): { lines: string[]; log: (msg: string) => void } {
    const lines: string[] = [];
    return { lines, log: (msg: string) => lines.push(msg) };
  }

  it('prints speedup and saved minutes', () => {
    const { lines, log } = captureLog();
    runBenchmark(3, log);
    const text = lines.join('\n');
    expect(text).toContain('Speedup:');
    expect(text).toContain('Wall time saved:');
  });

  it('parallel time is less than sequential time', () => {
    const { lines, log } = captureLog();
    runBenchmark(3, log);
    const text = lines.join('\n');
    // Sequential line format: "  M1(3) → M2(3) → ... = 36 min"
    const seqMatch = text.match(/M1\(\d+\).*?=\s*(\d+)\s*min/);
    const parMatch = text.match(/Total:\s*(\d+)\s*min/);
    expect(seqMatch).not.toBeNull();
    expect(parMatch).not.toBeNull();
    expect(Number(parMatch![1])).toBeLessThan(Number(seqMatch![1]));
  });

  it('respects --step-minutes override', () => {
    const { lines: lines5, log: log5 } = captureLog();
    const { lines: lines10, log: log10 } = captureLog();
    runBenchmark(5, log5);
    runBenchmark(10, log10);
    const totalMatch5 = lines5.join('\n').match(/Total:\s*(\d+)\s*min/);
    const totalMatch10 = lines10.join('\n').match(/Total:\s*(\d+)\s*min/);
    expect(Number(totalMatch10![1])).toBe(Number(totalMatch5![1]) * 2);
  });

  it('includes reproduce steps', () => {
    const { lines, log } = captureLog();
    runBenchmark(3, log);
    const text = lines.join('\n');
    expect(text).toContain('npx fleetspark init');
    expect(text).toContain('npx fleetspark command');
  });

  it('shows wave breakdown', () => {
    const { lines, log } = captureLog();
    runBenchmark(3, log);
    const text = lines.join('\n');
    expect(text).toContain('Wave 1:');
    expect(text).toContain('Wave 2:');
  });
});
