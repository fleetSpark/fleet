import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseConfig, type FleetConfig } from './schema.js';

export async function loadConfig(repoRoot: string): Promise<FleetConfig> {
  const configPath = join(repoRoot, '.fleet', 'config.yml');
  let raw: unknown = {};

  try {
    const content = await readFile(configPath, 'utf-8');
    raw = parseYaml(content) ?? {};
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
    // No config file — use defaults
  }

  return parseConfig(raw);
}
