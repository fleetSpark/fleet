import type { FleetPlugin, PluginConfig } from './types.js';

export class PluginLoader {
  private plugins: FleetPlugin[] = [];

  async load(configs: PluginConfig[]): Promise<void> {
    for (const config of configs) {
      try {
        // Dynamic import — plugin must be installed in node_modules
        const mod = await import(config.name) as { default?: FleetPlugin } & FleetPlugin;
        const plugin: FleetPlugin = mod.default ?? mod;

        if (typeof plugin.name !== 'string' || typeof plugin.version !== 'string') {
          console.warn(`[fleet] Plugin "${config.name}" does not export a valid FleetPlugin (missing name/version). Skipping.`);
          continue;
        }

        this.plugins.push(plugin);
        console.log(`[fleet] Loaded plugin: ${plugin.name} v${plugin.version}`);
      } catch (err) {
        console.warn(`[fleet] Failed to load plugin "${config.name}": ${String(err)}`);
      }
    }
  }

  getPlugins(): FleetPlugin[] {
    return [...this.plugins];
  }
}
