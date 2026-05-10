import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

export function registerPluginCommand(program: Command): void {
  const pluginCmd = program
    .command('plugin')
    .description('Manage Fleet plugins');

  pluginCmd
    .command('install <package>')
    .description('Install a Fleet plugin and register it in .fleet/config.yml')
    .action(async (pkg: string) => {
      console.log(`Installing plugin: ${pkg}...`);

      // 1. npm install the package
      try {
        execSync(`npm install ${pkg}`, { stdio: 'inherit' });
      } catch {
        console.error(`Failed to install ${pkg} via npm.`);
        process.exit(1);
      }

      // 2. Add to .fleet/config.yml
      const configPath = join(process.cwd(), '.fleet', 'config.yml');
      let raw: string;
      try {
        raw = await readFile(configPath, 'utf8');
      } catch {
        console.error('No .fleet/config.yml found. Run "fleet init" first.');
        process.exit(1);
      }

      const config = yamlLoad(raw) as Record<string, unknown>;
      const plugins = (config.plugins as Array<{ name: string }> | undefined) ?? [];

      if (plugins.some((p) => p.name === pkg)) {
        console.log(`Plugin "${pkg}" is already registered in config.yml.`);
        return;
      }

      plugins.push({ name: pkg });
      config.plugins = plugins;
      await writeFile(configPath, yamlDump(config), 'utf8');

      console.log(`\nPlugin "${pkg}" installed and registered.`);
      console.log(`Fleet will load it automatically on the next "fleet ship --join" or "fleet command".`);
    });

  pluginCmd
    .command('list')
    .description('List registered plugins in .fleet/config.yml')
    .action(async () => {
      const configPath = join(process.cwd(), '.fleet', 'config.yml');
      let raw: string;
      try {
        raw = await readFile(configPath, 'utf8');
      } catch {
        console.error('No .fleet/config.yml found.');
        process.exit(1);
      }

      const config = yamlLoad(raw) as Record<string, unknown>;
      const plugins = (config.plugins as Array<{ name: string }> | undefined) ?? [];

      if (plugins.length === 0) {
        console.log('No plugins registered. Install one with "fleet plugin install <package>".');
        return;
      }

      console.log('Registered plugins:');
      for (const p of plugins) {
        console.log(`  - ${p.name}`);
      }
    });
}
