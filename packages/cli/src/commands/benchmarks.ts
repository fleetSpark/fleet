import type { Command } from 'commander';
import {
  RealGitOps,
  parseFleetManifest,
  computeBenchmarks,
  renderBenchmarks,
} from '@fleetspark/core';

export function registerBenchmarksCommand(program: Command): void {
  program
    .command('benchmarks')
    .description('Per-agent success rate, throughput, and best-fit tracking')
    .option('--json', 'Output machine-readable JSON')
    .option('--min-sample <n>', 'Minimum terminal outcomes for best-fit eligibility', '3')
    .action(async (options) => {
      const git = new RealGitOps(process.cwd());

      let manifest;
      try {
        const content = await git.readFile('fleet/state', 'FLEET.md');
        manifest = parseFleetManifest(content);
      } catch {
        console.error('No fleet state found. Run "fleet init" first.');
        process.exit(1);
      }

      const report = computeBenchmarks(manifest, {
        minSample: Math.max(1, parseInt(options.minSample, 10) || 3),
      });

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderBenchmarks(report));
      }
    });
}
