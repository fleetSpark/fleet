import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempRepo, createBareRemote, git } from './helpers.js';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import {
  RealGitOps,
  CommanderElection,
  parseFleetManifest,
  writeFleetManifest,
} from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';

describe('CommanderElection (integration)', { timeout: 15_000 }, () => {
  let repoDir: string;
  let remoteDir: string;
  let cleanupRepo: () => Promise<void>;
  let cleanupRemote: () => Promise<void>;
  let ops: RealGitOps;
  let election: CommanderElection;

  /**
   * Helper: initialise fleet/state branch with a FLEET.md manifest
   */
  async function initFleetState(manifest: FleetManifest): Promise<void> {
    await ops.createOrphanBranch('fleet/state');
    await writeFile(join(repoDir, 'FLEET.md'), writeFleetManifest(manifest));
    await git(repoDir, 'add', 'FLEET.md');
    await git(repoDir, 'commit', '-m', 'fleet: init');
    await git(repoDir, 'push', '-u', 'origin', 'fleet/state');
    await ops.checkout('main');
  }

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
    election = new CommanderElection();
  });

  afterEach(async () => {
    await cleanupRepo();
    await cleanupRemote();
  });

  it('claim succeeds when no commander exists (empty host)', async () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: {
        host: '',
        lastCheckin: new Date(),
        status: 'active',
        timeoutMinutes: 15,
      },
      missions: [],
      mergeQueue: [],
      completed: [],
    };

    await initFleetState(manifest);

    const result = election.canClaim(manifest, 'host-alpha');
    expect(result.canClaim).toBe(true);
    expect(result.reason).toContain('No commander');

    // Full claim via gitOps
    const claimed = await election.claim(ops, 'host-alpha');
    expect(claimed).toBe(true);

    // Verify the manifest was updated on fleet/state
    const content = await ops.readFile('fleet/state', 'FLEET.md');
    const updated = parseFleetManifest(content);
    expect(updated.commander.host).toBe('host-alpha');
    expect(updated.commander.status).toBe('active');
  });

  it('heartbeat updates lastCheckin timestamp', async () => {
    const now = new Date('2026-03-20T10:00:00Z');
    const manifest: FleetManifest = {
      updated: now,
      commander: {
        host: 'host-alpha',
        lastCheckin: now,
        status: 'active',
        timeoutMinutes: 15,
      },
      missions: [],
      mergeQueue: [],
      completed: [],
    };

    await initFleetState(manifest);

    // Heartbeat
    await election.heartbeat(ops, 'host-alpha');

    // Read back and verify lastCheckin was updated
    const content = await ops.readFile('fleet/state', 'FLEET.md');
    const updated = parseFleetManifest(content);
    expect(updated.commander.host).toBe('host-alpha');
    // lastCheckin should be more recent than the original
    expect(updated.commander.lastCheckin.getTime()).toBeGreaterThan(now.getTime());
  });

  it('heartbeat throws if called by non-commander host', async () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: {
        host: 'host-alpha',
        lastCheckin: new Date(),
        status: 'active',
        timeoutMinutes: 15,
      },
      missions: [],
      mergeQueue: [],
      completed: [],
    };

    await initFleetState(manifest);

    await expect(
      election.heartbeat(ops, 'host-beta')
    ).rejects.toThrow('Cannot heartbeat');
  });

  it('release sets commander status to offline', async () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: {
        host: 'host-alpha',
        lastCheckin: new Date(),
        status: 'active',
        timeoutMinutes: 15,
      },
      missions: [],
      mergeQueue: [],
      completed: [],
    };

    await initFleetState(manifest);

    await election.release(ops, 'host-alpha');

    const content = await ops.readFile('fleet/state', 'FLEET.md');
    const updated = parseFleetManifest(content);
    expect(updated.commander.host).toBe('host-alpha');
    expect(updated.commander.status).toBe('offline');
  });

  it('canClaim returns true after commander timeout', () => {
    const longAgo = new Date(Date.now() - 60 * 60 * 1000); // 60 minutes ago
    const manifest: FleetManifest = {
      updated: longAgo,
      commander: {
        host: 'host-alpha',
        lastCheckin: longAgo,
        status: 'active',
        timeoutMinutes: 15,
      },
      missions: [],
      mergeQueue: [],
      completed: [],
    };

    const result = election.canClaim(manifest, 'host-beta');
    expect(result.canClaim).toBe(true);
    expect(result.reason).toContain('timed out');
  });

  it('canClaim returns false when active commander exists and has not timed out', () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: {
        host: 'host-alpha',
        lastCheckin: new Date(),
        status: 'active',
        timeoutMinutes: 15,
      },
      missions: [],
      mergeQueue: [],
      completed: [],
    };

    const result = election.canClaim(manifest, 'host-beta');
    expect(result.canClaim).toBe(false);
    expect(result.reason).toContain('host-alpha');
    expect(result.reason).toContain('active');
  });

  it('canClaim returns true when commander status is offline', () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: {
        host: 'host-alpha',
        lastCheckin: new Date(),
        status: 'offline',
        timeoutMinutes: 15,
      },
      missions: [],
      mergeQueue: [],
      completed: [],
    };

    const result = election.canClaim(manifest, 'host-beta');
    expect(result.canClaim).toBe(true);
    expect(result.reason).toContain('offline');
  });

  it('claim after release allows new host to take over', async () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: {
        host: 'host-alpha',
        lastCheckin: new Date(),
        status: 'active',
        timeoutMinutes: 15,
      },
      missions: [],
      mergeQueue: [],
      completed: [],
    };

    await initFleetState(manifest);

    // host-alpha releases
    await election.release(ops, 'host-alpha');

    // host-beta claims
    const claimed = await election.claim(ops, 'host-beta');
    expect(claimed).toBe(true);

    const content = await ops.readFile('fleet/state', 'FLEET.md');
    const updated = parseFleetManifest(content);
    expect(updated.commander.host).toBe('host-beta');
    expect(updated.commander.status).toBe('active');
  });
});
