import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShipHeartbeat } from '@fleet/core';
import type { GitOps, MissionLog } from '@fleet/core';

function mockGitOps(): GitOps {
  return {
    clone: vi.fn(),
    checkout: vi.fn(),
    createBranch: vi.fn(),
    createOrphanBranch: vi.fn(),
    readFile: vi.fn(),
    writeAndPush: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn(),
    getCurrentBranch: vi.fn().mockResolvedValue('feature/test'),
    branchExists: vi.fn(),
    getRemoteUrl: vi.fn(),
    addAndCommit: vi.fn(),
    pushNewBranch: vi.fn(),
  };
}

function makeMissionLog(): MissionLog {
  return {
    branch: 'feature/test',
    ship: 'ship-a',
    agent: 'claude-code',
    status: 'in-progress',
    brief: 'Test mission',
    steps: [
      { text: 'Step 1', done: true },
      { text: 'Step 2', done: false },
    ],
    blockers: [],
    heartbeat: { lastPush: new Date(), pushInterval: 60 },
  };
}

describe('ShipHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes MISSION.md on each tick', async () => {
    const git = mockGitOps();
    const heartbeat = new ShipHeartbeat(git, 60);
    heartbeat.start(makeMissionLog());

    await vi.advanceTimersByTimeAsync(60_000);

    expect(git.writeAndPush).toHaveBeenCalledTimes(1);
    expect(git.writeAndPush).toHaveBeenCalledWith(
      'feature/test',
      'MISSION.md',
      expect.any(String),
      expect.stringContaining('heartbeat')
    );
  });

  it('stops timer on stop()', async () => {
    const git = mockGitOps();
    const heartbeat = new ShipHeartbeat(git, 60);
    heartbeat.start(makeMissionLog());

    heartbeat.stop();
    await vi.advanceTimersByTimeAsync(120_000);

    // Only the final push from stop(), no timer pushes
    expect(git.writeAndPush).toHaveBeenCalledTimes(1);
  });
});
