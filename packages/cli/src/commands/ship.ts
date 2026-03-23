import type { Command } from 'commander';
import { hostname } from 'node:os';
import { join } from 'node:path';
import {
  RealGitOps,
  parseFleetManifest,
  writeFleetManifest,
  parseMissionLog,
  loadConfig,
  transition,
  ShipHeartbeat,
} from '@fleet/core';
import type { Mission } from '@fleet/core';

export function registerShipCommand(program: Command): void {
  program
    .command('ship')
    .description('Join a fleet as a ship')
    .requiredOption('--join <repo>', 'Git repository URL to join')
    .action(async (options) => {
      const repo = options.join;
      const shipId = `ship-${hostname()}`;
      const workDir = join(process.cwd(), `fleet-ship-${Date.now()}`);

      console.log(`Joining fleet as ${shipId}...`);

      // Clone the repo
      const git = new RealGitOps(workDir);
      await git.clone(repo, workDir);

      // Read FLEET.md from fleet/state
      const content = await git.readFile('fleet/state', 'FLEET.md');
      const manifest = parseFleetManifest(content);

      // Find assignment
      let mission: Mission | undefined;

      // Check for explicit assignment first
      mission = manifest.missions.find(
        (m) => m.ship === shipId && m.status === 'assigned'
      );

      // Auto-assign first ready mission
      if (!mission) {
        mission = manifest.missions.find((m) => m.status === 'ready');
      }

      if (!mission) {
        console.log('No missions available. Waiting for assignment...');
        mission = await waitForMission(git, shipId);
      }

      // Update FLEET.md with assignment
      mission.ship = shipId;
      if (mission.status === 'ready') {
        mission.status = transition(mission.status, 'assign');
      }
      manifest.updated = new Date();

      await git.writeAndPush(
        'fleet/state',
        'FLEET.md',
        writeFleetManifest(manifest),
        `fleet: assign ${mission.id} to ${shipId}`
      );

      // Checkout mission branch
      await git.checkout(mission.branch);

      // Read mission log
      const missionContent = await git.readFile(mission.branch, 'MISSION.md');
      const missionLog = parseMissionLog(missionContent);

      // Transition to in-progress
      mission.status = transition(mission.status, 'start');
      missionLog.status = 'in-progress';
      missionLog.ship = shipId;

      // Update FLEET.md
      manifest.updated = new Date();
      await git.writeAndPush(
        'fleet/state',
        'FLEET.md',
        writeFleetManifest(manifest),
        `fleet: ${mission.id} in-progress`
      );

      // Load config and start adapter
      const config = await loadConfig(workDir);

      console.log(`Executing mission ${mission.id}: ${mission.branch}`);
      console.log(`Brief: ${missionLog.brief}`);

      // Start heartbeat
      const heartbeat = new ShipHeartbeat(
        git,
        config.heartbeat.interval_seconds
      );
      heartbeat.start(missionLog);

      // Load and start the adapter
      try {
        const { claudeAdapter } = await import('@fleet/adapter-claude');
        const session = await claudeAdapter.start(
          {
            id: mission.id,
            branch: mission.branch,
            brief: missionLog.brief,
            agent: mission.agent,
            depends: mission.depends,
          }
        );

        console.log(`Agent started (PID: ${session.pid}). Heartbeat active.`);

        // Monitor adapter until it exits
        const checkInterval = setInterval(async () => {
          const alive = await claudeAdapter.isAlive(session);
          if (!alive) {
            clearInterval(checkInterval);
            heartbeat.stop();
            console.log(`Mission ${mission!.id} agent has exited.`);
          }
        }, 10_000);
      } catch (err) {
        console.error('Failed to start adapter:', err);
        heartbeat.stop();
        process.exit(1);
      }
    });
}

async function waitForMission(git: RealGitOps, shipId: string): Promise<Mission> {
  while (true) {
    await new Promise((r) => setTimeout(r, 30_000));
    console.log('Polling for mission assignment...');
    try {
      const content = await git.readFile('fleet/state', 'FLEET.md');
      const manifest = parseFleetManifest(content);
      const mission = manifest.missions.find(
        (m) => m.status === 'ready' || (m.ship === shipId && m.status === 'assigned')
      );
      if (mission) return mission;
    } catch {
      // Retry on next poll
    }
  }
}
