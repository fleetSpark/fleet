import { describe, it, expect, afterEach } from 'vitest';
import { createTempRepo, git } from './helpers.js';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { RealGitOps, ConflictDetector, transition } from '@fleet/core';
import type { Mission } from '@fleet/core';

describe('MergeCommander: conflict detection (integration)', { timeout: 15_000 }, () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups.length = 0;
  });

  it('diffNameOnly returns files changed between main and a feature branch', async () => {
    const repo = await createTempRepo();
    cleanups.push(repo.cleanup);

    const ops = new RealGitOps(repo.dir);

    // Create a feature branch with new files
    await git(repo.dir, 'checkout', '-b', 'feature/auth');
    await writeFile(join(repo.dir, 'auth.ts'), 'export function login() {}');
    await writeFile(join(repo.dir, 'middleware.ts'), 'export function authMiddleware() {}');
    await git(repo.dir, 'add', '.');
    await git(repo.dir, 'commit', '-m', 'feat: add auth');

    const diff = await ops.diffNameOnly('main', 'feature/auth');
    expect(diff).toContain('auth.ts');
    expect(diff).toContain('middleware.ts');
    expect(diff).not.toContain('README.md');
  });

  it('ConflictDetector.check returns no conflicts when branches touch different files', async () => {
    const repo = await createTempRepo();
    cleanups.push(repo.cleanup);

    const ops = new RealGitOps(repo.dir);

    // Branch A modifies auth.ts
    await git(repo.dir, 'checkout', '-b', 'feature/auth');
    await writeFile(join(repo.dir, 'auth.ts'), 'export function login() {}');
    await git(repo.dir, 'add', '.');
    await git(repo.dir, 'commit', '-m', 'feat: auth');

    // Branch B modifies db.ts (from main)
    await git(repo.dir, 'checkout', 'main');
    await git(repo.dir, 'checkout', '-b', 'feature/db');
    await writeFile(join(repo.dir, 'db.ts'), 'export function connect() {}');
    await git(repo.dir, 'add', '.');
    await git(repo.dir, 'commit', '-m', 'feat: db');

    const detector = new ConflictDetector(ops);

    const missionA: Mission = {
      id: 'M1', branch: 'feature/auth', ship: 'ship-a',
      agent: 'claude-code', status: 'completed', depends: [], blocker: 'none',
    };
    const missionB: Mission = {
      id: 'M2', branch: 'feature/db', ship: 'ship-b',
      agent: 'claude-code', status: 'in-progress', depends: [], blocker: 'none',
    };

    const report = await detector.check(missionA, [missionA, missionB]);
    expect(report.missionId).toBe('M1');
    expect(report.overlappingFiles).toHaveLength(0);
  });

  it('ConflictDetector.check returns conflicts when branches modify the same file', async () => {
    const repo = await createTempRepo();
    cleanups.push(repo.cleanup);

    const ops = new RealGitOps(repo.dir);

    // Branch A modifies shared.ts
    await git(repo.dir, 'checkout', '-b', 'feature/auth');
    await writeFile(join(repo.dir, 'shared.ts'), 'export const config = { auth: true };');
    await writeFile(join(repo.dir, 'auth.ts'), 'export function login() {}');
    await git(repo.dir, 'add', '.');
    await git(repo.dir, 'commit', '-m', 'feat: auth with shared config');

    // Branch B also modifies shared.ts (from main)
    await git(repo.dir, 'checkout', 'main');
    await git(repo.dir, 'checkout', '-b', 'feature/db');
    await writeFile(join(repo.dir, 'shared.ts'), 'export const config = { db: true };');
    await writeFile(join(repo.dir, 'db.ts'), 'export function connect() {}');
    await git(repo.dir, 'add', '.');
    await git(repo.dir, 'commit', '-m', 'feat: db with shared config');

    const detector = new ConflictDetector(ops);

    const missionA: Mission = {
      id: 'M1', branch: 'feature/auth', ship: 'ship-a',
      agent: 'claude-code', status: 'completed', depends: [], blocker: 'none',
    };
    const missionB: Mission = {
      id: 'M2', branch: 'feature/db', ship: 'ship-b',
      agent: 'claude-code', status: 'in-progress', depends: [], blocker: 'none',
    };

    const report = await detector.check(missionA, [missionA, missionB]);
    expect(report.missionId).toBe('M1');
    expect(report.overlappingFiles.length).toBeGreaterThan(0);
    expect(report.overlappingFiles[0].file).toBe('shared.ts');
    expect(report.overlappingFiles[0].conflictsWith).toBe('feature/db');
  });

  it('ConflictDetector skips missions with non-active statuses', async () => {
    const repo = await createTempRepo();
    cleanups.push(repo.cleanup);

    const ops = new RealGitOps(repo.dir);

    // Branch A modifies shared.ts
    await git(repo.dir, 'checkout', '-b', 'feature/auth');
    await writeFile(join(repo.dir, 'shared.ts'), 'export const a = 1;');
    await git(repo.dir, 'add', '.');
    await git(repo.dir, 'commit', '-m', 'feat: auth');

    // Branch B also modifies shared.ts but has status 'ready' (should be skipped)
    await git(repo.dir, 'checkout', 'main');
    await git(repo.dir, 'checkout', '-b', 'feature/db');
    await writeFile(join(repo.dir, 'shared.ts'), 'export const b = 2;');
    await git(repo.dir, 'add', '.');
    await git(repo.dir, 'commit', '-m', 'feat: db');

    const detector = new ConflictDetector(ops);

    const missionA: Mission = {
      id: 'M1', branch: 'feature/auth', ship: 'ship-a',
      agent: 'claude-code', status: 'completed', depends: [], blocker: 'none',
    };
    // 'ready' status is not in the checked list (in-progress, completed, merge-queued)
    const missionB: Mission = {
      id: 'M2', branch: 'feature/db', ship: null,
      agent: 'claude-code', status: 'ready', depends: [], blocker: 'none',
    };

    const report = await detector.check(missionA, [missionA, missionB]);
    expect(report.overlappingFiles).toHaveLength(0);
  });

  it('transition moves completed -> merge-queued -> merged', () => {
    let status = 'completed' as string;
    status = transition(status as any, 'queue_merge');
    expect(status).toBe('merge-queued');
    status = transition(status as any, 'merge');
    expect(status).toBe('merged');
  });
});
