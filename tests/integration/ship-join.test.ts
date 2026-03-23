import { describe, it, expect, afterEach } from 'vitest';
import { createTempRepo, createBareRemote, git } from './helpers.js';
import { join } from 'node:path';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  RealGitOps,
  parseFleetManifest,
  writeFleetManifest,
} from '@fleet/core';
import type { FleetManifest } from '@fleet/core';

describe('fleet ship --join (integration)', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups.length = 0;
  });

  it('clones repo and reads FLEET.md from fleet/state', async () => {
    const repo = await createTempRepo();
    const remote = await createBareRemote();
    cleanups.push(repo.cleanup, remote.cleanup);

    // Set up remote with fleet/state branch
    await git(repo.dir, 'remote', 'add', 'origin', remote.dir);
    await git(repo.dir, 'push', '-u', 'origin', 'main');

    const gitOps = new RealGitOps(repo.dir);
    await gitOps.createOrphanBranch('fleet/state');

    const manifest: FleetManifest = {
      updated: new Date(),
      commander: {
        host: 'test-commander',
        lastCheckin: new Date(),
        status: 'active',
        timeoutMinutes: 15,
      },
      missions: [
        {
          id: 'M1',
          branch: 'feature/test',
          ship: null,
          agent: 'claude-code',
          status: 'ready',
          depends: [],
          blocker: 'none',
        },
      ],
      mergeQueue: [],
      completed: [],
    };

    await writeFile(
      join(repo.dir, 'FLEET.md'),
      writeFleetManifest(manifest)
    );
    await git(repo.dir, 'add', 'FLEET.md');
    await git(repo.dir, 'commit', '-m', 'fleet: init');
    await git(repo.dir, 'push', '-u', 'origin', 'fleet/state');
    await gitOps.checkout('main');

    // Clone into a new directory (simulating a ship)
    const shipDir = await mkdtemp(join(tmpdir(), 'fleet-ship-'));
    cleanups.push(async () => {
      const { rm } = await import('node:fs/promises');
      await rm(shipDir, { recursive: true, force: true });
    });

    await git(shipDir, 'clone', remote.dir, '.');
    const shipGit = new RealGitOps(shipDir);

    // Read FLEET.md from fleet/state
    await git(shipDir, 'fetch', 'origin', 'fleet/state');
    const content = await shipGit.readFile('origin/fleet/state', 'FLEET.md');
    const parsedManifest = parseFleetManifest(content);

    expect(parsedManifest.missions).toHaveLength(1);
    expect(parsedManifest.missions[0].id).toBe('M1');
    expect(parsedManifest.missions[0].status).toBe('ready');
  });
});
