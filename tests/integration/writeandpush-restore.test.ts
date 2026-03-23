import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempRepo, createBareRemote, git } from './helpers.js';
import { join } from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
import { RealGitOps } from '@fleetspark/core';

describe('writeAndPush branch restoration (integration)', { timeout: 15_000 }, () => {
  let repoDir: string;
  let remoteDir: string;
  let cleanupRepo: () => Promise<void>;
  let cleanupRemote: () => Promise<void>;
  let ops: RealGitOps;

  beforeEach(async () => {
    const remote = await createBareRemote();
    remoteDir = remote.dir;
    cleanupRemote = remote.cleanup;

    const repo = await createTempRepo();
    repoDir = repo.dir;
    cleanupRepo = repo.cleanup;

    await git(repoDir, 'remote', 'add', 'origin', remoteDir);
    await git(repoDir, 'push', '-u', 'origin', 'main');

    ops = new RealGitOps(repoDir);
  });

  afterEach(async () => {
    await cleanupRepo();
    await cleanupRemote();
  });

  it('restores original branch after writeAndPush to a different branch', async () => {
    // Create fleet/state branch with initial content
    await ops.createOrphanBranch('fleet/state');
    await writeFile(join(repoDir, 'FLEET.md'), '# Initial manifest\n');
    await git(repoDir, 'add', 'FLEET.md');
    await git(repoDir, 'commit', '-m', 'fleet: init');
    await git(repoDir, 'push', '-u', 'origin', 'fleet/state');

    // Switch back to main
    await ops.checkout('main');
    const branchBefore = await ops.getCurrentBranch();
    expect(branchBefore).toBe('main');

    // writeAndPush to fleet/state while on main
    await ops.writeAndPush(
      'fleet/state',
      'FLEET.md',
      '# Updated manifest\nUpdated content here.\n',
      'fleet: update manifest'
    );

    // Verify we are back on main
    const branchAfter = await ops.getCurrentBranch();
    expect(branchAfter).toBe('main');

    // Verify the content was actually written to fleet/state
    const content = await ops.readFile('fleet/state', 'FLEET.md');
    expect(content).toContain('Updated manifest');
  });

  it('restores branch even when starting from a feature branch', async () => {
    // Create fleet/state branch
    await ops.createOrphanBranch('fleet/state');
    await writeFile(join(repoDir, 'STATE.md'), '# State\n');
    await git(repoDir, 'add', 'STATE.md');
    await git(repoDir, 'commit', '-m', 'fleet: init state');
    await git(repoDir, 'push', '-u', 'origin', 'fleet/state');

    // Create and switch to a feature branch
    await ops.checkout('main');
    await ops.createBranch('feature/work');
    await writeFile(join(repoDir, 'work.ts'), 'export const x = 1;');
    await git(repoDir, 'add', '.');
    await git(repoDir, 'commit', '-m', 'feat: work');

    const branchBefore = await ops.getCurrentBranch();
    expect(branchBefore).toBe('feature/work');

    // writeAndPush to fleet/state while on feature/work
    await ops.writeAndPush(
      'fleet/state',
      'STATE.md',
      '# State\nUpdated from feature branch.\n',
      'fleet: update from feature'
    );

    // Should be back on feature/work, not main
    const branchAfter = await ops.getCurrentBranch();
    expect(branchAfter).toBe('feature/work');
  });

  it('does not switch branches when already on the target branch', async () => {
    // Create fleet/state branch
    await ops.createOrphanBranch('fleet/state');
    await writeFile(join(repoDir, 'DATA.md'), '# Data\n');
    await git(repoDir, 'add', 'DATA.md');
    await git(repoDir, 'commit', '-m', 'fleet: init data');
    await git(repoDir, 'push', '-u', 'origin', 'fleet/state');

    // Stay on fleet/state
    const branchBefore = await ops.getCurrentBranch();
    expect(branchBefore).toBe('fleet/state');

    // writeAndPush while already on fleet/state
    await ops.writeAndPush(
      'fleet/state',
      'DATA.md',
      '# Data\nUpdated in-place.\n',
      'fleet: update data'
    );

    // Should still be on fleet/state
    const branchAfter = await ops.getCurrentBranch();
    expect(branchAfter).toBe('fleet/state');

    const content = await ops.readFile('fleet/state', 'DATA.md');
    expect(content).toContain('Updated in-place');
  });

  it('writeAndPush creates parent directories for nested file paths', async () => {
    // Create fleet/state branch
    await ops.createOrphanBranch('fleet/state');
    await writeFile(join(repoDir, 'FLEET.md'), '# Init\n');
    await git(repoDir, 'add', 'FLEET.md');
    await git(repoDir, 'commit', '-m', 'fleet: init');
    await git(repoDir, 'push', '-u', 'origin', 'fleet/state');

    await ops.checkout('main');

    // Write a nested path
    await ops.writeAndPush(
      'fleet/state',
      'missions/M1/brief.md',
      '# Mission M1\nBuild the auth system.\n',
      'fleet: add M1 brief'
    );

    // Verify branch restored
    const branchAfter = await ops.getCurrentBranch();
    expect(branchAfter).toBe('main');

    // Verify nested file was written
    const content = await ops.readFile('fleet/state', 'missions/M1/brief.md');
    expect(content).toContain('Mission M1');
  });
});
