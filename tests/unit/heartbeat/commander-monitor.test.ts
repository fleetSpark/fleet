import { describe, it, expect, vi } from 'vitest';
import { CommanderMonitor, writeMissionLog } from '@fleetspark/core';
import type { GitOps, Mission } from '@fleetspark/core';

function mockGitOps(): GitOps {
  return {
    clone: vi.fn(),
    checkout: vi.fn(),
    createBranch: vi.fn(),
    createOrphanBranch: vi.fn(),
    readFile: vi.fn(),
    writeAndPush: vi.fn(),
    pull: vi.fn(),
    getCurrentBranch: vi.fn(),
    branchExists: vi.fn(),
    getRemoteUrl: vi.fn(),
    addAndCommit: vi.fn(),
    pushNewBranch: vi.fn(),
  };
}

function makeActiveMission(overrides?: Partial<Mission>): Mission {
  return {
    id: 'M1',
    branch: 'feature/test',
    ship: 'ship-a',
    agent: 'claude-code',
    status: 'in-progress',
    depends: [],
    blocker: 'none',
    ...overrides,
  };
}

function makeMissionLogMd(lastPushDate: Date) {
  return writeMissionLog({
    branch: 'feature/test',
    ship: 'ship-a',
    agent: 'claude-code',
    status: 'in-progress',
    brief: 'Test',
    steps: [{ text: 'Step 1', done: false }],
    blockers: [],
    heartbeat: { lastPush: lastPushDate, pushInterval: 60 },
  });
}

describe('CommanderMonitor', () => {
  it('reports alive for recent heartbeat', async () => {
    const git = mockGitOps();
    (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMissionLogMd(new Date())
    );

    const monitor = new CommanderMonitor(git, {
      stallThresholdMin: 30,
      unresponsiveThresholdMin: 10,
    });

    const health = await monitor.poll([makeActiveMission()]);
    expect(health[0].status).toBe('alive');
  });

  it('reports stale for heartbeat past unresponsive threshold', async () => {
    const git = mockGitOps();
    const oldTime = new Date(Date.now() - 15 * 60 * 1000); // 15 min ago
    (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMissionLogMd(oldTime)
    );

    const monitor = new CommanderMonitor(git, {
      stallThresholdMin: 30,
      unresponsiveThresholdMin: 10,
    });

    const health = await monitor.poll([makeActiveMission()]);
    expect(health[0].status).toBe('stale');
  });

  it('reports dead for heartbeat past stall threshold', async () => {
    const git = mockGitOps();
    const veryOldTime = new Date(Date.now() - 45 * 60 * 1000); // 45 min ago
    (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeMissionLogMd(veryOldTime)
    );

    const monitor = new CommanderMonitor(git, {
      stallThresholdMin: 30,
      unresponsiveThresholdMin: 10,
    });

    const health = await monitor.poll([makeActiveMission()]);
    expect(health[0].status).toBe('dead');
  });

  // Negative-path tests
  it('reports dead when MISSION.md cannot be read', async () => {
    const git = mockGitOps();
    (git.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('not found')
    );

    const monitor = new CommanderMonitor(git, {
      stallThresholdMin: 30,
      unresponsiveThresholdMin: 10,
    });

    const health = await monitor.poll([makeActiveMission()]);
    expect(health[0].status).toBe('dead');
    expect(health[0].stepProgress).toBe('unknown');
  });

  it('skips non-in-progress missions', async () => {
    const git = mockGitOps();
    const monitor = new CommanderMonitor(git, {
      stallThresholdMin: 30,
      unresponsiveThresholdMin: 10,
    });

    const health = await monitor.poll([
      makeActiveMission({ status: 'completed' }),
    ]);
    expect(health).toHaveLength(0);
    expect(git.readFile).not.toHaveBeenCalled();
  });

  it('skips missions with no ship assigned', async () => {
    const git = mockGitOps();
    const monitor = new CommanderMonitor(git, {
      stallThresholdMin: 30,
      unresponsiveThresholdMin: 10,
    });

    const health = await monitor.poll([
      makeActiveMission({ ship: null }),
    ]);
    expect(health).toHaveLength(0);
  });
});
