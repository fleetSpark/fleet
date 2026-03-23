import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MergeCommander } from '@fleet/core';
import type { GitOps, FleetManifest, Mission, PRStatus } from '@fleet/core';

function createMockGitOps(overrides: Partial<GitOps> = {}): GitOps {
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
    fetchBranch: vi.fn(),
    createPR: vi.fn().mockResolvedValue('https://github.com/test/repo/pull/1'),
    getPRStatus: vi.fn().mockResolvedValue(null),
    mergePR: vi.fn(),
    ...overrides,
  };
}

function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'M1', branch: 'feature/test', ship: 'ship-a', agent: 'claude-code',
    status: 'completed', depends: [], blocker: 'none', ...overrides,
  };
}

function makeManifest(missions: Mission[]): FleetManifest {
  return {
    updated: new Date(),
    commander: { host: 'test', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
    missions, mergeQueue: [], completed: [],
  };
}

describe('MergeCommander', () => {
  it('creates PR for completed mission', async () => {
    const git = createMockGitOps();
    const mc = new MergeCommander(git, { ciRequired: true, autoRebase: true });
    const mission = makeMission({ status: 'completed' });
    const results = await mc.tick(makeManifest([mission]));
    expect(git.createPR).toHaveBeenCalledWith('feature/test', 'main', expect.any(String), expect.any(String));
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe('pr-created');
    expect(results[0].missionId).toBe('M1');
  });

  it('skips PR creation if PR already exists', async () => {
    const git = createMockGitOps({
      getPRStatus: vi.fn().mockResolvedValue({
        state: 'open', mergeable: true, ciStatus: 'pending', hasConflicts: false, url: 'https://github.com/test/repo/pull/1',
      } satisfies PRStatus),
    });
    const mc = new MergeCommander(git, { ciRequired: true, autoRebase: true });
    const results = await mc.tick(makeManifest([makeMission({ status: 'completed' })]));
    expect(git.createPR).not.toHaveBeenCalled();
    expect(results[0].action).toBe('ci-pending');
  });

  it('auto-merges when CI passes and no conflicts', async () => {
    const git = createMockGitOps({
      getPRStatus: vi.fn().mockResolvedValue({
        state: 'open', mergeable: true, ciStatus: 'success', hasConflicts: false, url: 'https://github.com/test/repo/pull/1',
      } satisfies PRStatus),
    });
    const mc = new MergeCommander(git, { ciRequired: true, autoRebase: true });
    const results = await mc.tick(makeManifest([makeMission({ status: 'merge-queued' })]));
    expect(git.mergePR).toHaveBeenCalledWith('feature/test', 'merge');
    expect(results[0].action).toBe('merged');
  });

  it('reports ci-pending when checks are running', async () => {
    const git = createMockGitOps({
      getPRStatus: vi.fn().mockResolvedValue({
        state: 'open', mergeable: true, ciStatus: 'pending', hasConflicts: false, url: 'https://github.com/test/repo/pull/1',
      } satisfies PRStatus),
    });
    const mc = new MergeCommander(git, { ciRequired: true, autoRebase: true });
    const results = await mc.tick(makeManifest([makeMission({ status: 'merge-queued' })]));
    expect(git.mergePR).not.toHaveBeenCalled();
    expect(results[0].action).toBe('ci-pending');
  });

  it('reports ci-failed when checks fail', async () => {
    const git = createMockGitOps({
      getPRStatus: vi.fn().mockResolvedValue({
        state: 'open', mergeable: true, ciStatus: 'failure', hasConflicts: false, url: 'https://github.com/test/repo/pull/1',
      } satisfies PRStatus),
    });
    const mc = new MergeCommander(git, { ciRequired: true, autoRebase: true });
    const results = await mc.tick(makeManifest([makeMission({ status: 'merge-queued' })]));
    expect(results[0].action).toBe('ci-failed');
  });

  it('reports conflict when PR has conflicts', async () => {
    const git = createMockGitOps({
      getPRStatus: vi.fn().mockResolvedValue({
        state: 'open', mergeable: false, ciStatus: 'success', hasConflicts: true, url: 'https://github.com/test/repo/pull/1',
      } satisfies PRStatus),
    });
    const mc = new MergeCommander(git, { ciRequired: true, autoRebase: true });
    const results = await mc.tick(makeManifest([makeMission({ status: 'merge-queued' })]));
    expect(results[0].action).toBe('conflict');
    expect(results[0].requiresApproval).toBe(true);
  });

  it('auto-merges without CI when ciRequired is false', async () => {
    const git = createMockGitOps({
      getPRStatus: vi.fn().mockResolvedValue({
        state: 'open', mergeable: true, ciStatus: 'none', hasConflicts: false, url: 'https://github.com/test/repo/pull/1',
      } satisfies PRStatus),
    });
    const mc = new MergeCommander(git, { ciRequired: false, autoRebase: true });
    const results = await mc.tick(makeManifest([makeMission({ status: 'merge-queued' })]));
    expect(git.mergePR).toHaveBeenCalled();
    expect(results[0].action).toBe('merged');
  });

  it('ignores missions in non-completed/merge-queued states', async () => {
    const git = createMockGitOps();
    const mc = new MergeCommander(git, { ciRequired: true, autoRebase: true });
    const missions = [
      makeMission({ id: 'M1', status: 'in-progress' }),
      makeMission({ id: 'M2', status: 'pending' }),
      makeMission({ id: 'M3', status: 'ready' }),
    ];
    const results = await mc.tick(makeManifest(missions));
    expect(results).toHaveLength(0);
    expect(git.createPR).not.toHaveBeenCalled();
  });
});
