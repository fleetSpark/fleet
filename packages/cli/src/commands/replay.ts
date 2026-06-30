import type { Command } from 'commander';
import {
  RealGitOps,
  loadConfig,
  parseFleetManifest,
  writeFleetManifest,
  writeMissionLog,
  applyReplay,
} from '@fleetspark/core';
import type { MissionLog } from '@fleetspark/core';

export function registerReplayCommand(program: Command): void {
  program
    .command('replay <missionId>')
    .description('Re-run a failed or completed mission from scratch')
    .action(async (missionId: string) => {
      const cwd = process.cwd();
      const git = new RealGitOps(cwd);
      const config = await loadConfig(cwd);

      let manifest;
      try {
        const content = await git.readFile('fleet/state', 'FLEET.md');
        manifest = parseFleetManifest(content);
      } catch {
        console.error('No fleet state found. Run "fleet init" first.');
        process.exit(1);
      }

      const result = applyReplay(manifest, missionId);
      if (!result.ok || !result.mission) {
        console.error(result.error ?? 'Replay failed.');
        process.exit(1);
      }
      const mission = result.mission;

      // Persist the reset manifest.
      await git.writeAndPush(
        'fleet/state',
        'FLEET.md',
        writeFleetManifest(manifest),
        `fleet: replay ${missionId}`
      );

      // Reset the mission branch from the target and re-seed MISSION.md.
      const targetBranch = config.merge?.target_branch ?? 'main';
      try {
        await git.createBranch(mission.branch, targetBranch);
      } catch {
        // Branch may already exist — fall through and overwrite MISSION.md.
      }

      const missionLog: MissionLog = {
        branch: mission.branch,
        ship: '',
        agent: mission.agent,
        status: mission.status,
        brief: `Replay of ${missionId}`,
        steps: [],
        blockers: [],
        heartbeat: { lastPush: new Date(), pushInterval: config.heartbeat.interval_seconds },
      };
      await git.writeAndPush(
        mission.branch,
        'MISSION.md',
        writeMissionLog(missionLog),
        `fleet: reset mission ${missionId} for replay`
      );

      console.log(`Mission ${missionId} reset to "${mission.status}" on ${mission.branch}.`);
      console.log('A ready ship will pick it up, or assign one with "fleet assign".');
    });
}
