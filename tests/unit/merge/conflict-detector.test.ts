import { describe, it, expect, vi } from 'vitest';
import { ConflictDetector } from '@fleetspark/core';
import type { GitOps, Mission } from '@fleetspark/core';

function createMockGitOps(diffResults: Record<string, string[]>): GitOps {
  return {
    clone: vi.fn(), checkout: vi.fn(), createBranch: vi.fn(), createOrphanBranch: vi.fn(),
    readFile: vi.fn(), writeAndPush: vi.fn(), pull: vi.fn(), getCurrentBranch: vi.fn(),
    branchExists: vi.fn(), getRemoteUrl: vi.fn(), addAndCommit: vi.fn(), pushNewBranch: vi.fn(),
    fetchBranch: vi.fn(), createPR: vi.fn(), getPRStatus: vi.fn(), mergePR: vi.fn(),
    diffNameOnly: vi.fn().mockImplementation((_base: string, head: string) => {
      return Promise.resolve(diffResults[head] ?? []);
    }),
  } as unknown as GitOps;
}

describe('ConflictDetector', () => {
  it('detects overlapping files between branches', async () => {
    const git = createMockGitOps({
      'feature/auth': ['src/auth.ts', 'src/middleware.ts'],
      'feature/db': ['src/db.ts', 'src/middleware.ts'],
    });
    const detector = new ConflictDetector(git);
    const mission: Mission = { id: 'M1', branch: 'feature/auth', ship: 'ship-a', agent: 'claude-code', status: 'completed', depends: [], blocker: 'none' };
    const others: Mission[] = [
      { id: 'M2', branch: 'feature/db', ship: 'ship-b', agent: 'claude-code', status: 'in-progress', depends: [], blocker: 'none' },
    ];
    const report = await detector.check(mission, [mission, ...others]);
    expect(report.overlappingFiles).toHaveLength(1);
    expect(report.overlappingFiles[0].file).toBe('src/middleware.ts');
    expect(report.overlappingFiles[0].conflictsWith).toBe('feature/db');
  });

  it('returns empty when no overlaps', async () => {
    const git = createMockGitOps({
      'feature/auth': ['src/auth.ts'],
      'feature/db': ['src/db.ts'],
    });
    const detector = new ConflictDetector(git);
    const mission: Mission = { id: 'M1', branch: 'feature/auth', ship: 'ship-a', agent: 'claude-code', status: 'completed', depends: [], blocker: 'none' };
    const others: Mission[] = [
      { id: 'M2', branch: 'feature/db', ship: 'ship-b', agent: 'claude-code', status: 'in-progress', depends: [], blocker: 'none' },
    ];
    const report = await detector.check(mission, [mission, ...others]);
    expect(report.overlappingFiles).toHaveLength(0);
  });

  it('ignores missions in non-active states', async () => {
    const git = createMockGitOps({
      'feature/auth': ['src/shared.ts'],
      'feature/old': ['src/shared.ts'],
    });
    const detector = new ConflictDetector(git);
    const mission: Mission = { id: 'M1', branch: 'feature/auth', ship: 'ship-a', agent: 'claude-code', status: 'completed', depends: [], blocker: 'none' };
    const others: Mission[] = [
      { id: 'M2', branch: 'feature/old', ship: null, agent: 'claude-code', status: 'merged', depends: [], blocker: 'none' },
    ];
    const report = await detector.check(mission, [mission, ...others]);
    expect(report.overlappingFiles).toHaveLength(0);
  });

  it('uses main as the diff base by default', async () => {
    const diffSpy = vi.fn().mockResolvedValue([]);
    const git = {
      clone: vi.fn(), checkout: vi.fn(), createBranch: vi.fn(), createOrphanBranch: vi.fn(),
      readFile: vi.fn(), writeAndPush: vi.fn(), pull: vi.fn(), getCurrentBranch: vi.fn(),
      branchExists: vi.fn(), getRemoteUrl: vi.fn(), addAndCommit: vi.fn(), pushNewBranch: vi.fn(),
      fetchBranch: vi.fn(), createPR: vi.fn(), getPRStatus: vi.fn(), mergePR: vi.fn(),
      diffNameOnly: diffSpy,
    } as unknown as GitOps;
    const detector = new ConflictDetector(git);
    const mission: Mission = { id: 'M1', branch: 'feature/auth', ship: 'ship-a', agent: 'claude-code', status: 'completed', depends: [], blocker: 'none' };
    await detector.check(mission, [mission]);
    expect(diffSpy).toHaveBeenCalledWith('main', 'feature/auth');
  });

  it('uses configured targetBranch as the diff base when provided', async () => {
    const diffSpy = vi.fn().mockImplementation((base: string, head: string) => {
      const map: Record<string, string[]> = {
        'feature/auth': ['src/a.ts', 'src/shared.ts'],
        'feature/db': ['src/db.ts', 'src/shared.ts'],
      };
      return Promise.resolve(map[head] ?? []);
    });
    const git = {
      clone: vi.fn(), checkout: vi.fn(), createBranch: vi.fn(), createOrphanBranch: vi.fn(),
      readFile: vi.fn(), writeAndPush: vi.fn(), pull: vi.fn(), getCurrentBranch: vi.fn(),
      branchExists: vi.fn(), getRemoteUrl: vi.fn(), addAndCommit: vi.fn(), pushNewBranch: vi.fn(),
      fetchBranch: vi.fn(), createPR: vi.fn(), getPRStatus: vi.fn(), mergePR: vi.fn(),
      diffNameOnly: diffSpy,
    } as unknown as GitOps;
    const detector = new ConflictDetector(git, 'claude/multi-tenant-studio-setup-3VDFC');
    const mission: Mission = { id: 'M1', branch: 'feature/auth', ship: 'ship-a', agent: 'claude-code', status: 'completed', depends: [], blocker: 'none' };
    const others: Mission[] = [
      { id: 'M2', branch: 'feature/db', ship: 'ship-b', agent: 'claude-code', status: 'in-progress', depends: [], blocker: 'none' },
    ];
    const report = await detector.check(mission, [mission, ...others]);
    expect(diffSpy).toHaveBeenCalledWith('claude/multi-tenant-studio-setup-3VDFC', 'feature/auth');
    expect(diffSpy).toHaveBeenCalledWith('claude/multi-tenant-studio-setup-3VDFC', 'feature/db');
    expect(report.overlappingFiles).toHaveLength(1);
    expect(report.overlappingFiles[0].file).toBe('src/shared.ts');
  });
});
