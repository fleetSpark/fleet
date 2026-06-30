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
  resolveAdapter,
  PluginLoader,
  buildProvisionSpec,
  renderProvisionSpec,
  type CloudProvider,
} from '@fleetspark/core';
import type { Mission } from '@fleetspark/core';

export function registerShipCommand(program: Command): void {
  program
    .command('ship')
    .description('Join a fleet as a ship')
    .option('--join <repo>', 'Git repository URL to join')
    .option('--spawn <provider>', 'Provision a cloud ship: aws|fly|gcp')
    .option('--repo <url>', 'Repo URL for the spawned ship to join (with --spawn)')
    .option('--agent <name>', 'Coding agent the spawned ship should run')
    .option('--size <size>', 'Cloud machine size (with --spawn)')
    .option('--region <region>', 'Cloud region/zone (with --spawn)')
    .option('--apply', 'Execute the provisioning command (default: print artifacts)')
    .action(async (options) => {
      if (options.spawn) {
        await handleSpawn(options);
        return;
      }
      if (!options.join) {
        console.error('Specify --join <repo> to join a fleet, or --spawn <provider> to provision a cloud ship.');
        process.exit(1);
      }
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

      // Load config, load plugins, run onBeforeMissionStart hooks
      const config = await loadConfig(workDir);
      const loader = new PluginLoader();
      await loader.load(config.plugins ?? []);
      const plugins = loader.getPlugins();
      const pluginContext = { workDir, repoUrl: repo };

      for (const plugin of plugins) {
        if (plugin.onBeforeMissionStart) {
          const result = await plugin.onBeforeMissionStart(mission, pluginContext);
          if (result.block) {
            console.error(`\n[fleet] Plugin "${plugin.name}" blocked mission ${mission.id}:`);
            console.error(`  ${result.reason ?? 'No reason provided.'}`);
            console.error(`\nResolve the issue, then retry fleet ship --join.`);
            process.exit(1);
          }
        }
      }

      console.log(`Executing mission ${mission.id}: ${mission.branch}`);
      console.log(`Brief: ${missionLog.brief}`);

      // Start heartbeat
      const heartbeat = new ShipHeartbeat(
        git,
        config.heartbeat.interval_seconds
      );
      heartbeat.start(missionLog);

      // Read FLEET_CONTEXT.md from main branch if available
      let briefContext: string | undefined;
      try {
        briefContext = await git.readFile('main', 'FLEET_CONTEXT.md');
      } catch {
        // No brief available
      }

      // Load and start the adapter
      try {
        const adapter = await resolveAdapter(mission.agent);
        const session = await adapter.start(
          {
            id: mission.id,
            branch: mission.branch,
            brief: missionLog.brief,
            agent: mission.agent,
            depends: mission.depends,
          },
          briefContext
        );

        console.log(`Agent started (PID: ${session.pid}). Heartbeat active.`);

        // Monitor adapter until it exits
        const checkInterval = setInterval(async () => {
          const alive = await adapter.isAlive(session);
          if (!alive) {
            clearInterval(checkInterval);
            heartbeat.stop();

            // Distinguish clean exit from signal-kill / crash. Adapters that
            // implement getExitInfo() let us avoid the v1.1.6-and-prior bug
            // where any process disappearance was marked `completed` — including
            // SIGTERM/SIGKILL from the operator. If the adapter can't tell
            // (older adapter, race condition), fall back to legacy "assume
            // completed" behavior to preserve compatibility.
            const exitInfo = adapter.getExitInfo
              ? await adapter.getExitInfo(session)
              : undefined;
            const cleanExit = exitInfo ? exitInfo.cleanExit : true;

            if (!cleanExit) {
              console.log(
                `Mission ${mission!.id} agent terminated abnormally ` +
                  `(exitCode=${exitInfo?.exitCode ?? 'null'}, signal=${exitInfo?.signal ?? 'null'}). ` +
                  `Marking failed — NOT completed. MISSION.md left untouched so the next operator can inspect.`
              );
              try {
                missionLog.status = 'failed';
                missionLog.blockers = [
                  ...(missionLog.blockers ?? []),
                  `agent terminated abnormally: signal=${exitInfo?.signal ?? 'null'}, exitCode=${exitInfo?.exitCode ?? 'null'}`,
                ];
                const { writeMissionLog } = await import('@fleetspark/core');
                await git.writeAndPush(
                  mission!.branch,
                  'MISSION.md',
                  writeMissionLog(missionLog),
                  `fleet: ${mission!.id} failed (agent killed/crashed)`
                );

                mission!.status = transition(mission!.status, 'fail');
                manifest.updated = new Date();
                await git.writeAndPush(
                  'fleet/state',
                  'FLEET.md',
                  writeFleetManifest(manifest),
                  `fleet: ${mission!.id} failed`
                );
                console.log(`Mission ${mission!.id} marked as failed.`);
              } catch (err) {
                console.error(`Failed to update mission status to failed:`, err);
              }
              return;
            }

            console.log(`Mission ${mission!.id} agent has exited cleanly. Marking completed.`);

            try {
              // Update MISSION.md status
              missionLog.status = 'completed';
              const { writeMissionLog } = await import('@fleetspark/core');
              await git.writeAndPush(
                mission!.branch,
                'MISSION.md',
                writeMissionLog(missionLog),
                `fleet: ${mission!.id} completed`
              );

              // Update FLEET.md
              mission!.status = transition(mission!.status, 'complete');
              manifest.updated = new Date();
              await git.writeAndPush(
                'fleet/state',
                'FLEET.md',
                writeFleetManifest(manifest),
                `fleet: ${mission!.id} completed`
              );
              console.log(`Mission ${mission!.id} marked as completed.`);
            } catch (err) {
              console.error(`Failed to update mission status:`, err);
            }
          }
        }, 10_000);
      } catch (err) {
        console.error('Failed to start adapter:', err);
        heartbeat.stop();
        process.exit(1);
      }
    });
}

async function handleSpawn(options: {
  spawn: string;
  repo?: string;
  join?: string;
  agent?: string;
  size?: string;
  region?: string;
  apply?: boolean;
}): Promise<void> {
  const provider = options.spawn as CloudProvider;
  if (!['aws', 'fly', 'gcp'].includes(provider)) {
    console.error(`Unsupported provider "${provider}". Use aws, fly, or gcp.`);
    process.exit(1);
  }
  const repo = options.repo ?? options.join;
  if (!repo) {
    console.error('Provisioning requires a repo URL. Pass --repo <url>.');
    process.exit(1);
  }

  let spec;
  try {
    spec = buildProvisionSpec({
      provider,
      repo,
      ...(options.agent ? { agent: options.agent } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.region ? { region: options.region } : {}),
    });
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  // Always write the cloud-init script so the launch command can reference it.
  const { writeFile } = await import('node:fs/promises');
  const initPath = 'fleet-ship-cloud-init.sh';
  await writeFile(initPath, spec.cloudInit, 'utf-8');

  console.log(renderProvisionSpec(spec));
  console.log(`\ncloud-init written to ${initPath}`);

  if (!options.apply) {
    console.log('\n(dry run — re-run with --apply to execute the launch command)');
    return;
  }

  console.log(`\nLaunching ${provider} ship "${spec.name}"...`);
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  try {
    const { stdout } = await run(spec.launchCommand[0], spec.launchCommand.slice(1));
    console.log(stdout);
    console.log(`Ship "${spec.name}" provisioning started.`);
  } catch (err) {
    console.error(`Provisioning failed: ${(err as Error).message}`);
    console.error(`Ensure the ${provider} CLI is installed and authenticated. ${spec.notes}`);
    process.exit(1);
  }
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
