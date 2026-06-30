import type { Command } from 'commander';
import { hostname } from 'node:os';
import { RealGitOps, loadConfig, LivenessPublisher, type MachineMode } from '@fleetspark/core';

export function registerHeartbeatCommand(program: Command): void {
  program
    .command('heartbeat')
    .description('Publish non-mission liveness so this machine shows alive without running a mission')
    .option('--mode <mode>', 'Machine mode: mission|manual (overrides config)')
    .option('--interval <seconds>', 'Heartbeat interval in seconds (overrides config)')
    .option('--host <name>', 'Override the published hostname')
    .option('--note <text>', 'Attach a short note to the presence record')
    .option('--once', 'Publish a single heartbeat and exit')
    .action(async (options) => {
      const cwd = process.cwd();
      const git = new RealGitOps(cwd);
      const config = await loadConfig(cwd);

      const mode: MachineMode =
        options.mode === 'mission' || options.mode === 'manual'
          ? options.mode
          : config.machine?.mode ?? 'manual';

      if (options.mode && options.mode !== 'mission' && options.mode !== 'manual') {
        console.error(`Invalid --mode "${options.mode}". Use "mission" or "manual".`);
        process.exit(1);
      }

      const intervalSeconds = options.interval
        ? Math.max(1, parseInt(options.interval, 10) || config.heartbeat.interval_seconds)
        : config.heartbeat.interval_seconds;

      const host = options.host ?? config.machine?.id ?? hostname();

      const publisher = new LivenessPublisher(git, {
        host,
        mode,
        intervalSeconds,
        ...(options.note ? { note: options.note } : {}),
      });

      if (options.once) {
        const presence = await publisher.publishOnce();
        console.log(`Published liveness for ${presence.host} (${presence.mode}) @ ${presence.lastSeen}`);
        return;
      }

      console.log(
        `Publishing liveness for ${host} (${mode}) every ${intervalSeconds}s. Ctrl+C to stop.`
      );
      publisher.start();

      const shutdown = () => {
        publisher.stop();
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}
