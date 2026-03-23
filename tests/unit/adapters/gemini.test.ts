import { describe, it, expect, vi } from 'vitest';
import { geminiAdapter } from '@fleet/adapter-gemini';

vi.mock('node:child_process', () => ({
  spawn: vi.fn().mockReturnValue({
    pid: 12345,
    stdin: { write: vi.fn(), writable: true },
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  }),
}));

describe('geminiAdapter', () => {
  it('has correct name', () => {
    expect(geminiAdapter.name).toBe('gemini');
  });

  it('start() spawns gemini process and returns session', async () => {
    const session = await geminiAdapter.start({
      id: 'M1',
      branch: 'feature/test',
      brief: 'Implement a test feature',
      agent: 'gemini',
      depends: [],
    });
    expect(session.pid).toBe(12345);
    expect(session.missionId).toBe('M1');
    expect(session.adapter).toBe('gemini');
  });

  it('isAlive() returns true for running process', async () => {
    const session = await geminiAdapter.start({
      id: 'M1',
      branch: 'feature/test',
      brief: 'Test',
      agent: 'gemini',
      depends: [],
    });
    const spy = vi.spyOn(process, 'kill').mockReturnValue(true);
    const alive = await geminiAdapter.isAlive(session);
    expect(alive).toBe(true);
    spy.mockRestore();
  });

  it('isAlive() returns false when process gone', async () => {
    const session = await geminiAdapter.start({
      id: 'M1',
      branch: 'feature/test',
      brief: 'Test',
      agent: 'gemini',
      depends: [],
    });
    const spy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });
    const alive = await geminiAdapter.isAlive(session);
    expect(alive).toBe(false);
    spy.mockRestore();
  });
});
