import { describe, it, expect, afterEach } from 'vitest';
import { createTempRepo, git } from './helpers.js';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { RealGitOps, writeMissionLog, parseMissionLog } from '@fleetspark/core';
import type { MissionLog } from '@fleetspark/core';

describe('heartbeat (integration)', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups.length = 0;
  });

  it('MISSION.md push appears in git log', async () => {
    const repo = await createTempRepo();
    cleanups.push(repo.cleanup);

    const gitOps = new RealGitOps(repo.dir);
    await gitOps.createBranch('feature/test');

    const missionLog: MissionLog = {
      branch: 'feature/test',
      ship: 'ship-test',
      agent: 'claude-code',
      status: 'in-progress',
      brief: 'Test mission',
      steps: [
        { text: 'Step 1', done: true },
        { text: 'Step 2', done: false },
      ],
      blockers: [],
      heartbeat: { lastPush: new Date(), pushInterval: 60 },
    };

    await writeFile(
      join(repo.dir, 'MISSION.md'),
      writeMissionLog(missionLog)
    );
    await git(repo.dir, 'add', 'MISSION.md');
    await git(repo.dir, 'commit', '-m', 'heartbeat: initial');

    // Verify MISSION.md is committed
    const log = await git(repo.dir, 'log', '--oneline', '-1');
    expect(log).toContain('heartbeat');

    // Update and recommit (simulate heartbeat tick)
    missionLog.steps[1].done = true;
    missionLog.heartbeat.lastPush = new Date();
    await writeFile(
      join(repo.dir, 'MISSION.md'),
      writeMissionLog(missionLog)
    );
    await git(repo.dir, 'add', 'MISSION.md');
    await git(repo.dir, 'commit', '-m', 'heartbeat: update');

    // Read back and verify
    const content = await gitOps.readFile('feature/test', 'MISSION.md');
    const parsed = parseMissionLog(content);
    expect(parsed.steps[1].done).toBe(true);
  });
});
