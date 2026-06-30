import { describe, it, expect } from 'vitest';
import {
  loadMarketplaceIndex,
  searchMarketplace,
  getEntry,
  entryToPlan,
  builtinEntries,
} from '@fleetspark/core';

describe('marketplace', () => {
  it('includes built-in templates by default', async () => {
    const index = await loadMarketplaceIndex();
    expect(index.entries.length).toBeGreaterThan(0);
    expect(index.entries.every((e) => e.origin)).toBe(true);
    expect(builtinEntries().some((e) => e.name === 'test-coverage')).toBe(true);
  });

  it('layers community entries from a JSON source', async () => {
    const community = JSON.stringify({
      entries: [
        { name: 'community-thing', description: 'Custom flow', author: 'alice', tags: ['custom'], missions: [{ id: 'M1', branch: 'b', brief: 'x', agent: 'claude', depends: [] }] },
      ],
    });
    const index = await loadMarketplaceIndex('extra.json', { readFile: async () => community });
    const entry = getEntry(index, 'community-thing');
    expect(entry).not.toBeNull();
    expect(entry!.author).toBe('alice');
    expect(entry!.origin).toBe('extra.json');
  });

  it('fetches a remote https index via injected fetcher', async () => {
    const index = await loadMarketplaceIndex('https://hub.example/index.json', {
      fetchJson: async () => ({ entries: [{ name: 'remote', description: 'r', missions: [] }] }),
    });
    expect(getEntry(index, 'remote')).not.toBeNull();
  });

  it('community entries override builtins of the same name', async () => {
    const community = JSON.stringify({
      entries: [{ name: 'refactor', description: 'OVERRIDDEN', missions: [] }],
    });
    const index = await loadMarketplaceIndex('x.json', { readFile: async () => community });
    expect(getEntry(index, 'refactor')!.description).toBe('OVERRIDDEN');
  });

  it('searches by name, description, and tags', async () => {
    const index = await loadMarketplaceIndex();
    expect(searchMarketplace(index, 'security').length).toBeGreaterThan(0);
    expect(searchMarketplace(index, 'zzzznope')).toHaveLength(0);
    expect(searchMarketplace(index, '').length).toBe(index.entries.length);
  });

  it('ignores malformed community entries', async () => {
    const bad = JSON.stringify({ entries: [{ description: 'no name' }, { name: 'ok', missions: [] }] });
    const index = await loadMarketplaceIndex('bad.json', { readFile: async () => bad });
    expect(getEntry(index, 'ok')).not.toBeNull();
  });

  it('converts an entry to a runnable plan', async () => {
    const index = await loadMarketplaceIndex();
    const entry = getEntry(index, 'test-coverage')!;
    const plan = entryToPlan(entry);
    expect(plan.missions.length).toBe(entry.missions.length);
  });
});
