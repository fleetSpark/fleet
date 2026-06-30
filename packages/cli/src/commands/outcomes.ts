import type { Command } from 'commander';
import {
  RealGitOps,
  parseFleetManifest,
  generateOutcomesJson,
  renderOutcomes,
} from '@fleetspark/core';

export function registerOutcomesCommand(program: Command): void {
  program
    .command('outcomes')
    .description('Stream mission outcomes (merged/failed/stalled/blocked) for planners')
    .option('--json', 'Output machine-readable JSON')
    .option('--watch', 'Re-read and print outcomes on an interval')
    .option('--interval <seconds>', 'Watch interval in seconds', '15')
    .action(async (options) => {
      const git = new RealGitOps(process.cwd());

      const readManifest = async () => {
        const content = await git.readFile('fleet/state', 'FLEET.md');
        return parseFleetManifest(content);
      };

      const printOnce = async () => {
        let manifest;
        try {
          manifest = await readManifest();
        } catch {
          console.error('No fleet state found. Run "fleet init" first.');
          process.exit(1);
        }
        if (options.json) {
          console.log(JSON.stringify(generateOutcomesJson(manifest), null, 2));
        } else {
          console.log(renderOutcomes(manifest));
        }
      };

      await printOnce();

      if (options.watch) {
        const intervalMs = Math.max(1, parseInt(options.interval, 10) || 15) * 1000;
        console.error(`\nWatching outcomes every ${intervalMs / 1000}s. Ctrl+C to stop.`);
        setInterval(() => {
          void (async () => {
            if (!options.json) console.log('\n---');
            await printOnce();
          })();
        }, intervalMs);
      }
    });
}
