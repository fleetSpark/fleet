import type { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import {
  RealGitOps,
  loadConfig,
  parseFleetManifest,
  generateReport,
  generateReportJson,
  analyzeRisk,
  renderRiskPanel,
  type GitOps,
} from '@fleetspark/core';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Generate a summary report of the current fleet run')
    .option('--json', 'Output machine-readable JSON')
    .option('--output <file>', 'Write report to file')
    .option('--live', 'Continuous health/risk panel that refreshes on an interval')
    .option('--interval <seconds>', 'Refresh interval for --live (default 15)', '15')
    .action(async (options) => {
      const git = new RealGitOps(process.cwd());

      if (options.live) {
        await runLive(git, options.interval, options.json);
        return;
      }

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

async function runLive(git: GitOps, intervalRaw: string, json: boolean): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd).catch(() => null);
  const knownShips = config?.ships?.map((s) => s.id) ?? [];

  const render = async () => {
    let manifest;
    try {
      const content = await git.readFile('fleet/state', 'FLEET.md');
      manifest = parseFleetManifest(content);
    } catch {
      console.error('No fleet state found. Run "fleet init" first.');
      process.exit(1);
    }
    const report = analyzeRisk(manifest, { knownShips });
    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.clear();
      console.log(renderRiskPanel(report));
    }
  };

  await render();

  const intervalMs = Math.max(1, parseInt(intervalRaw, 10) || 15) * 1000;
  if (!json) console.error(`\nRefreshing every ${intervalMs / 1000}s. Ctrl+C to stop.`);
  setInterval(() => void render(), intervalMs);
}
