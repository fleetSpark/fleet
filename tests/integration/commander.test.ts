import { describe, it, expect, afterEach } from 'vitest';
import { createTempRepo, git } from './helpers.js';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import {
  RealGitOps,
  writeMissionLog,
  CommanderMonitor,
} from '@fleetspark/core';
import type { Mission, MissionLog } from '@fleetspark/core';

describe('commander monitor (integration)', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups.length = 0;
  });

  it('detects dead ship from very old heartbeat timestamp', async () => {
    const repo = await createTempRepo();
    cleanups.push(repo.cleanup);

    const gitOps = new RealGitOps(repo.dir);
    await gitOps.createBranch('feature/dead');

    // Write MISSION.md with very old timestamp (45 min ago, past stall threshold)
    const oldTime = new Date(Date.now() - 45 * 60 * 1000);
    const missionLog: MissionLog = {
      branch: 'feature/dead',
      ship: 'ship-dead',
      agent: 'claude-code',
      status: 'in-progress',
      brief: 'Dead mission',
      steps: [{ text: 'Step 1', done: false }],
      blockers: [],
      heartbeat: { lastPush: oldTime, pushInterval: 60 },
    };

    await writeFile(
      join(repo.dir, 'MISSION.md'),
      writeMissionLog(missionLog)
    );
    await git(repo.dir, 'add', 'MISSION.md');
    await git(repo.dir, 'commit', '-m', 'heartbeat: old');

    // Monitor polls
    const monitor = new CommanderMonitor(gitOps, {
      stallThresholdMin: 30,
      unresponsiveThresholdMin: 10,
    });

    const missions: Mission[] = [
      {
        id: 'M1',
        branch: 'feature/dead',
        ship: 'ship-dead',
        agent: 'claude-code',
        status: 'in-progress',
        depends: [],
        blocker: 'none',
      },
    ];

    const health = await monitor.poll(missions);
    expect(health).toHaveLength(1);
    expect(health[0].status).toBe('dead');
  });
});
