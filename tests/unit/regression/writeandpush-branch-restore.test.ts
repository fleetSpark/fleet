import { describe, it, expect, vi } from 'vitest';
import { RealGitOps } from '@fleet/core';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execFile = promisify(execFileCb);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile('git', args, { cwd });
  return stdout.trim();
}

describe('writeAndPush branch restore on failure', () => {
  it('RealGitOps has writeAndPush method', () => {
    const ops = new RealGitOps('/tmp/fake');
    expect(typeof ops.writeAndPush).toBe('function');
  });

  it('source uses try/finally pattern to restore branch', async () => {
    // Read the actual source to verify the fix is in place
    const { readFileSync } = await import('node:fs');
    const sourcePath = join(
      process.cwd(),
      'packages/core/src/git/git-ops.ts',
    );
    const source = readFileSync(sourcePath, 'utf-8');

    // The writeAndPush method must use try/finally to restore the branch
    expect(source).toContain('try {');
    expect(source).toContain('} finally {');

    // The finally block should checkout the original branch
    const writeAndPushSection = source.slice(
      source.indexOf('async writeAndPush'),
      source.indexOf('async pull('),
    );
    expect(writeAndPushSection).toContain('finally');
    expect(writeAndPushSection).toContain('checkout(currentBranch)');
  });

  it('restores original branch even when push fails (integration)', async () => {
    // Create a temp git repo with no remote — push will always fail
    const tempDir = mkdtempSync(join(tmpdir(), 'fleet-test-'));
    try {
      await git(tempDir, 'init');
      await git(tempDir, 'config', 'user.email', 'test@test.com');
      await git(tempDir, 'config', 'user.name', 'Test');

      // Create initial commit on default branch
      writeFileSync(join(tempDir, 'README.md'), 'hello');
      await git(tempDir, 'add', '.');
      await git(tempDir, 'commit', '-m', 'init');

      // Detect the default branch name (master or main)
      const defaultBranch = await git(tempDir, 'rev-parse', '--abbrev-ref', 'HEAD');

      // Create a target branch
      await git(tempDir, 'checkout', '-b', 'fleet/manifest');
      writeFileSync(join(tempDir, 'FLEET.md'), 'manifest');
      await git(tempDir, 'add', '.');
      await git(tempDir, 'commit', '-m', 'manifest');

      // Go back to default branch
      await git(tempDir, 'checkout', defaultBranch);

      const ops = new RealGitOps(tempDir);
      const branchBefore = await ops.getCurrentBranch();
      expect(branchBefore).toBe(defaultBranch);

      // writeAndPush should fail (no remote), but branch should be restored
      await expect(
        ops.writeAndPush('fleet/manifest', 'FLEET.md', 'updated', 'update'),
      ).rejects.toThrow();

      const branchAfter = await ops.getCurrentBranch();
      expect(branchAfter).toBe(defaultBranch);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
