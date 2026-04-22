import type { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import {
  RealGitOps,
  parseFleetManifest,
  generateReport,
  generateReportJson,
} from '@fleetspark/core';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Generate a summary report of the current fleet run')
    .option('--json', 'Output machine-readable JSON')
    .option('--output <file>', 'Write report to file')
    .action(async (options) => {
      const git = new RealGitOps(process.cwd());

      let content: string;
      try {
        content = await git.readFile('fleet/state', 'FLEET.md');
      } catch {
        console.error('No fleet state found. Run "fleetspark init" first.');
        process.exit(1);
      }

      const manifest = parseFleetManifest(content);

      if (options.json) {
        const json = generateReportJson(manifest);
        const output = JSON.stringify(json, null, 2);
        if (options.output) {
          await writeFile(options.output, output, 'utf-8');
          console.log(`Report written to ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        const report = generateReport(manifest);
        if (options.output) {
          await writeFile(options.output, report, 'utf-8');
          console.log(`Report written to ${options.output}`);
        } else {
          console.log(report);
        }
      }
    });
}
