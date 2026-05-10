import { describe, it, expect } from 'vitest';
import { PluginLoader } from '@fleetspark/core';

describe('PluginLoader', () => {
  it('starts with no plugins loaded', () => {
    const loader = new PluginLoader();
    expect(loader.getPlugins()).toHaveLength(0);
  });

  it('loads no plugins when config array is empty', async () => {
    const loader = new PluginLoader();
    await loader.load([]);
    expect(loader.getPlugins()).toHaveLength(0);
  });

  it('skips plugins that cannot be imported (non-blocking)', async () => {
    const loader = new PluginLoader();
    await loader.load([{ name: '@fleetspark/plugin-does-not-exist' }]);
    // Should not throw — just warn and skip
    expect(loader.getPlugins()).toHaveLength(0);
  });

  it('returns a defensive copy of the plugins array', () => {
    const loader = new PluginLoader();
    const a = loader.getPlugins();
    const b = loader.getPlugins();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
