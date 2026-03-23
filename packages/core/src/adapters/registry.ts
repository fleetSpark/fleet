import type { FleetAdapter } from '../protocol/types.js';

const builtinAdapters: Record<string, string> = {
  'claude-code': '@fleet/adapter-claude',
  'codex': '@fleet/adapter-codex',
  'aider': '@fleet/adapter-aider',
};

export async function resolveAdapter(name: string): Promise<FleetAdapter> {
  const moduleName = builtinAdapters[name] ?? name;
  try {
    const mod = await import(moduleName as string);
    const adapterKey = Object.keys(mod).find(k => k.endsWith('Adapter') || k === 'default' || k === 'adapter');
    const adapter = mod.default ?? (adapterKey ? mod[adapterKey] : undefined);
    if (!adapter || typeof adapter.start !== 'function') {
      throw new Error(`Module ${moduleName} does not export a valid FleetAdapter`);
    }
    return adapter as FleetAdapter;
  } catch (err: any) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        `Adapter "${name}" not found. Install it with:\n  npm install ${moduleName}`
      );
    }
    throw err;
  }
}
