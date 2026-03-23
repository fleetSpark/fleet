import type { Command } from 'commander';
import { RealGitOps, parseFleetManifest } from '@fleet/core';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Display the current fleet mission board')
    .option('-w, --watch', 'Refresh every 5 seconds')
    .action(async (options) => {
      const render = async () => {
        const git = new RealGitOps(process.cwd());
        const content = await git.readFile('fleet/state', 'FLEET.md');
        const manifest = parseFleetManifest(content);

        const updatedAgo = formatTimeAgo(manifest.updated);

        console.clear();
        console.log(`Fleet Status — updated ${updatedAgo}`);
        console.log(
          `Commander: ${manifest.commander.host} (${manifest.commander.status})`
        );
        console.log('');

        if (manifest.missions.length === 0) {
          console.log('No active missions.');
        } else {
          const header = padRow('ID', 'Branch', 'Ship', 'Agent', 'Status', 'Depends');
          console.log(header);
          console.log('-'.repeat(header.length));

          for (const m of manifest.missions) {
            console.log(
              padRow(
                m.id,
                m.branch,
                m.ship ?? '—',
                m.agent,
                m.status,
                m.depends.length > 0 ? m.depends.join(', ') : 'none'
              )
            );
          }
        }

        if (manifest.mergeQueue.length > 0) {
          console.log('');
          console.log('Merge Queue:');
          for (const entry of manifest.mergeQueue) {
            console.log(`  ${entry.missionId} ${entry.branch} — ${entry.note}`);
          }
        }
      };

      await render();

      if (options.watch) {
        setInterval(() => void render(), 5000);
      }
    });
}

function padRow(...cols: string[]): string {
  const widths = [4, 24, 10, 14, 14, 10];
  return cols.map((col, i) => col.padEnd(widths[i] ?? 10)).join('');
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
