import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

export async function createTempRepo(): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), 'fleet-test-'));

  await execFile('git', ['init', '-b', 'main', dir]);
  await execFile('git', ['config', 'user.email', 'test@fleet.dev'], { cwd: dir });
  await execFile('git', ['config', 'user.name', 'Fleet Test'], { cwd: dir });

  // Create initial commit so branches work
  const readmePath = join(dir, 'README.md');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(readmePath, '# Test Repo\n');
  await execFile('git', ['add', '.'], { cwd: dir });
  await execFile('git', ['commit', '-m', 'initial'], { cwd: dir });

  return {
    dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function createBareRemote(): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), 'fleet-remote-'));
  await execFile('git', ['init', '--bare', dir]);
  return {
    dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile('git', args, { cwd });
  return stdout.trim();
}
