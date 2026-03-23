import type { Command } from 'commander';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { RealGitOps, writeFleetManifest, DEFAULT_CONFIG } from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';
import { stringify as yamlStringify } from 'yaml';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Fleet in the current repository')
    .action(async () => {
      const cwd = process.cwd();
      const fleetDir = join(cwd, '.fleet');
      const configPath = join(fleetDir, 'config.yml');

      // Check if already initialized
      if (existsSync(configPath)) {
        console.error('Fleet is already initialized in this repository.');
        process.exit(1);
      }

      // Create .fleet directory and config.yml
      mkdirSync(fleetDir, { recursive: true });
      await writeFile(configPath, yamlStringify(DEFAULT_CONFIG), 'utf-8');

      // Create fleet/state branch with empty FLEET.md
      const git = new RealGitOps(cwd);

      const emptyManifest: FleetManifest = {
        updated: new Date(),
        commander: {
          host: hostname(),
          lastCheckin: new Date(),
          status: 'active',
          timeoutMinutes: 15,
        },
        missions: [],
        mergeQueue: [],
        completed: [],
      };

      const manifestContent = writeFleetManifest(emptyManifest);

      // Save current branch, create orphan fleet/state, write FLEET.md, return
      const currentBranch = await git.getCurrentBranch();

      await git.createOrphanBranch('fleet/state');
      await writeFile(join(cwd, 'FLEET.md'), manifestContent, 'utf-8');
      await git.addAndCommit(['FLEET.md'], 'fleet: initialize fleet/state branch');

      // Push fleet/state to remote (ignore error if no remote)
      try {
        await git.pushNewBranch('fleet/state');
      } catch {
        console.log('Note: No remote found. Push fleet/state manually when ready.');
      }

      // Return to original branch
      await git.checkout(currentBranch);

      console.log('Fleet initialized.');
      console.log('  Config: .fleet/config.yml');
      console.log('  State: fleet/state branch (FLEET.md)');
      console.log('');
      console.log('Next steps:');
      console.log('  fleet command --plan "your goal here"');
      console.log('  fleet command --plan-file missions.yml');
    });
}
