import type { Command } from 'commander';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import {
  loadMarketplaceIndex,
  searchMarketplace,
  getEntry,
  entryToPlan,
} from '@fleetspark/core';

export function registerMarketplaceCommand(program: Command): void {
  const market = program
    .command('marketplace')
    .description('Discover and install community-contributed mission templates');

  market
    .command('list')
    .description('List available mission templates')
    .option('--source <url|file>', 'Additional marketplace index (JSON file or URL)')
    .option('--json', 'Output machine-readable JSON')
    .action(async (options) => {
      const index = await loadMarketplaceIndex(options.source);
      if (options.json) {
        console.log(JSON.stringify(index, null, 2));
        return;
      }
      console.log('Available mission templates:\n');
      for (const e of index.entries) {
        const author = e.author ? ` by ${e.author}` : '';
        console.log(`  ${e.name}${author} — ${e.description} (${e.missions.length} missions) [${e.origin}]`);
      }
    });

  market
    .command('search <query>')
    .description('Search mission templates by name, description, or tag')
    .option('--source <url|file>', 'Additional marketplace index (JSON file or URL)')
    .action(async (query: string, options) => {
      const index = await loadMarketplaceIndex(options.source);
      const results = searchMarketplace(index, query);
      if (results.length === 0) {
        console.log(`No templates match "${query}".`);
        return;
      }
      console.log(`${results.length} result(s) for "${query}":\n`);
      for (const e of results) {
        console.log(`  ${e.name} — ${e.description} (${e.missions.length} missions)`);
      }
    });

  market
    .command('install <name>')
    .description('Install a mission template into .fleet/ as a runnable plan')
    .option('--source <url|file>', 'Additional marketplace index (JSON file or URL)')
    .option('--output <file>', 'Plan output path (default .fleet/<name>.yml)')
    .action(async (name: string, options) => {
      const index = await loadMarketplaceIndex(options.source);
      const entry = getEntry(index, name);
      if (!entry) {
        console.error(`Template "${name}" not found. Run "fleet marketplace list".`);
        process.exit(1);
      }

      const outPath = options.output ?? join(process.cwd(), '.fleet', `${name}.yml`);
      await mkdir(join(process.cwd(), '.fleet'), { recursive: true }).catch(() => {});
      await writeFile(outPath, yamlStringify(entryToPlan(entry)), 'utf-8');

      console.log(`Installed "${name}" (${entry.missions.length} missions) to ${outPath}`);
      console.log(`Run it with:\n  fleet command --plan-file ${outPath}`);
    });
}
