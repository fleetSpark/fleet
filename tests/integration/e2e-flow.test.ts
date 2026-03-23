import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempRepo, createBareRemote, git } from './helpers.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  RealGitOps,
  parseFleetManifest,
  writeFleetManifest,
  parseMissionLog,
  writeMissionLog,
  transition,
  getReadyMissions,
  MergeCommander,
} from '@fleetspark/core';
import type { FleetManifest, Mission, MissionLog } from '@fleetspark/core';

describe('E2E flow: full mission lifecycle', () => {
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

  it('runs two missions with dependency, completing both', async () => {
    // Step 1: Create fleet/state with two missions (M2 depends on M1)
    await ops.createOrphanBranch('fleet/state');
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: { host: 'test-host', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
      missions: [
        { id: 'M1', branch: 'feature/auth', ship: null, agent: 'claude-code', status: 'ready', depends: [], blocker: 'none' },
        { id: 'M2', branch: 'feature/db', ship: null, agent: 'claude-code', status: 'pending', depends: ['M1'], blocker: 'none' },
      ],
      mergeQueue: [],
      completed: [],
    };
    await writeFile(join(repoDir, 'FLEET.md'), writeFleetManifest(manifest));
    await git(repoDir, 'add', 'FLEET.md');
    await git(repoDir, 'commit', '-m', 'fleet: init');
    await git(repoDir, 'push', '-u', 'origin', 'fleet/state');

    // Step 2: Create mission branches from main
    await git(repoDir, 'checkout', 'main');
    await git(repoDir, 'checkout', '-b', 'feature/auth');
    const m1Log: MissionLog = {
      branch: 'feature/auth', ship: '', agent: 'claude-code', status: 'ready',
      brief: 'Implement auth', steps: [], blockers: [],
      heartbeat: { lastPush: new Date(), pushInterval: 60 },
    };
    await writeFile(join(repoDir, 'MISSION.md'), writeMissionLog(m1Log));
    await git(repoDir, 'add', 'MISSION.md');
    await git(repoDir, 'commit', '-m', 'fleet: init M1');
    await git(repoDir, 'push', '-u', 'origin', 'feature/auth');

    await git(repoDir, 'checkout', 'main');
    await git(repoDir, 'checkout', '-b', 'feature/db');
    const m2Log: MissionLog = {
      branch: 'feature/db', ship: '', agent: 'claude-code', status: 'pending',
      brief: 'Set up database', steps: [], blockers: [],
      heartbeat: { lastPush: new Date(), pushInterval: 60 },
    };
    await writeFile(join(repoDir, 'MISSION.md'), writeMissionLog(m2Log));
    await git(repoDir, 'add', 'MISSION.md');
    await git(repoDir, 'commit', '-m', 'fleet: init M2');
    await git(repoDir, 'push', '-u', 'origin', 'feature/db');

    // Step 3: Simulate ship completing M1
    await git(repoDir, 'checkout', 'feature/auth');
    m1Log.ship = 'ship-a';
    m1Log.status = 'in-progress';
    m1Log.steps = [
      { text: 'Implement login', done: true },
      { text: 'Add middleware', done: true },
    ];
    m1Log.heartbeat.lastPush = new Date();
    await writeFile(join(repoDir, 'auth.ts'), 'export function login() { return true; }');
    await writeFile(join(repoDir, 'MISSION.md'), writeMissionLog(m1Log));
    await git(repoDir, 'add', '.');
    await git(repoDir, 'commit', '-m', 'feat: implement auth');
    await git(repoDir, 'push', 'origin', 'feature/auth');

    // Step 4: Mark M1 completed in FLEET.md
    await git(repoDir, 'checkout', 'fleet/state');
    const fleetContent = await ops.readFile('fleet/state', 'FLEET.md');
    const currentManifest = parseFleetManifest(fleetContent);
    const m1 = currentManifest.missions.find((m) => m.id === 'M1')!;
    m1.ship = 'ship-a';
    m1.status = 'completed';
    currentManifest.updated = new Date();
    await writeFile(join(repoDir, 'FLEET.md'), writeFleetManifest(currentManifest));
    await git(repoDir, 'add', 'FLEET.md');
    await git(repoDir, 'commit', '-m', 'fleet: M1 completed');
    await git(repoDir, 'push', 'origin', 'fleet/state');

    // Step 5: Verify DAG resolution — after M1 is merged, M2 should become ready
    const updatedContent = await ops.readFile('fleet/state', 'FLEET.md');
    const updatedManifest = parseFleetManifest(updatedContent);
    const m1Updated = updatedManifest.missions.find((m) => m.id === 'M1')!;
    // Simulate merge (skip PR creation since no GitHub)
    m1Updated.status = 'merge-queued';
    m1Updated.status = transition(m1Updated.status, 'merge');

    const ready = getReadyMissions(updatedManifest.missions);
    expect(ready.length).toBe(1);
    expect(ready[0].id).toBe('M2');

    ready[0].status = transition(ready[0].status, 'dependencies_met');
    expect(ready[0].status).toBe('ready');
  });
});
