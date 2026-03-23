import { describe, it, expect, vi } from 'vitest';
import { ampAdapter } from '@fleet/adapter-amp';

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

describe('ampAdapter', () => {
  it('has correct name', () => {
    expect(ampAdapter.name).toBe('amp');
  });

  it('start() spawns amp process and returns session', async () => {
    const session = await ampAdapter.start({
      id: 'M1',
      branch: 'feature/test',
      brief: 'Implement a test feature',
      agent: 'amp',
      depends: [],
    });
    expect(session.pid).toBe(12345);
    expect(session.missionId).toBe('M1');
    expect(session.adapter).toBe('amp');
  });

  it('isAlive() returns true for running process', async () => {
    const session = await ampAdapter.start({
      id: 'M1',
      branch: 'feature/test',
      brief: 'Test',
      agent: 'amp',
      depends: [],
    });
    const spy = vi.spyOn(process, 'kill').mockReturnValue(true);
    const alive = await ampAdapter.isAlive(session);
    expect(alive).toBe(true);
    spy.mockRestore();
  });

  it('isAlive() returns false when process gone', async () => {
    const session = await ampAdapter.start({
      id: 'M1',
      branch: 'feature/test',
      brief: 'Test',
      agent: 'amp',
      depends: [],
    });
    const spy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });
    const alive = await ampAdapter.isAlive(session);
    expect(alive).toBe(false);
    spy.mockRestore();
  });
});
