import { describe, it, expect, afterEach } from 'vitest';
import { createTempRepo, createBareRemote, git } from './helpers.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { RealGitOps, parseFleetManifest } from '@fleetspark/core';

describe('fleet init (integration)', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups.length = 0;
  });

  it('creates .fleet/config.yml and fleet/state branch', async () => {
    const repo = await createTempRepo();
    const remote = await createBareRemote();
    cleanups.push(repo.cleanup, remote.cleanup);

    await git(repo.dir, 'remote', 'add', 'origin', remote.dir);
    await git(repo.dir, 'push', '-u', 'origin', 'main');

    const gitOps = new RealGitOps(repo.dir);

    // Create .fleet/config.yml
    mkdirSync(join(repo.dir, '.fleet'), { recursive: true });
    await writeFile(join(repo.dir, '.fleet', 'config.yml'), 'commander:\n  model: claude-opus-4-5\n');

    expect(existsSync(join(repo.dir, '.fleet', 'config.yml'))).toBe(true);

    // Create fleet/state branch
    await gitOps.createOrphanBranch('fleet/state');
    await writeFile(join(repo.dir, 'FLEET.md'), '# Fleet manifest\n');
    await git(repo.dir, 'add', 'FLEET.md');
    await git(repo.dir, 'commit', '-m', 'fleet: init');
    await git(repo.dir, 'push', '-u', 'origin', 'fleet/state');

    // Verify branch exists on remote
    const branches = await git(remote.dir, 'branch');
    expect(branches).toContain('fleet/state');

    // Return to main
    await gitOps.checkout('main');
    const current = await gitOps.getCurrentBranch();
    expect(current).toBe('main');
  });

  it('can read FLEET.md from fleet/state branch via git show', async () => {
    const repo = await createTempRepo();
    cleanups.push(repo.cleanup);

    const gitOps = new RealGitOps(repo.dir);

    await gitOps.createOrphanBranch('fleet/state');

    const manifestMd = `# Fleet manifest
Updated: 2026-03-22T14:30:00.000Z

## Commander
host: test-host  |  last_checkin: 2026-03-22T14:30:00.000Z  |  status: active
timeout_minutes: 15

## Active missions
| ID | Branch | Ship | Agent | Status | Depends | Blocker |
|----|--------|------|-------|--------|---------|---------|

## Merge queue

## Completed
`;

    await writeFile(join(repo.dir, 'FLEET.md'), manifestMd);
    await git(repo.dir, 'add', 'FLEET.md');
    await git(repo.dir, 'commit', '-m', 'fleet: init');

    // Read FLEET.md from fleet/state branch using git show (no branch switch needed)
    const content = await gitOps.readFile('fleet/state', 'FLEET.md');
    const manifest = parseFleetManifest(content);

    expect(manifest.commander.host).toBe('test-host');
    expect(manifest.missions).toHaveLength(0);
  });
});
