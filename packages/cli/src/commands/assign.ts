import type { Command } from 'commander';
import {
  RealGitOps,
  parseFleetManifest,
  writeFleetManifest,
  transition,
} from '@fleetspark/core';

export function registerAssignCommand(program: Command): void {
  program
    .command('assign <missionId> <shipId>')
    .description('Manually assign a mission to a ship')
    .action(async (missionId: string, shipId: string) => {
      const git = new RealGitOps(process.cwd());
      const content = await git.readFile('fleet/state', 'FLEET.md');
      const manifest = parseFleetManifest(content);

      const mission = manifest.missions.find((m) => m.id === missionId);
      if (!mission) {
        console.error(`Mission ${missionId} not found.`);
        process.exit(1);
      }

      if (mission.status !== 'ready') {
        console.error(
          `Mission ${missionId} is '${mission.status}', must be 'ready' to assign.`
        );
        process.exit(1);
      }

      mission.ship = shipId;
      mission.status = transition(mission.status, 'assign');
      manifest.updated = new Date();

      await git.writeAndPush(
        'fleet/state',
        'FLEET.md',
        writeFleetManifest(manifest),
        `fleet: assign ${missionId} to ${shipId}`
      );

      console.log(`Mission ${missionId} assigned to ${shipId}.`);
    });
}
