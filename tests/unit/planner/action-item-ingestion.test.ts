import { describe, it, expect } from 'vitest';
import { ingestActionItems, ingestFromAdapters } from '@fleetspark/core';
import type { ActionItemSource, ActionItemAdapter } from '@fleetspark/core';

describe('ingestActionItems', () => {
  it('extracts TODO/FIXME/follow-up markers from commits', () => {
    const sources: ActionItemSource[] = [
      { kind: 'commit', ref: 'a1b2c3d', text: 'fix login\n\nTODO: add rate limiting to the auth endpoint' },
      { kind: 'commit', ref: 'e4f5g6h', text: 'FIXME: null deref when session is empty' },
    ];
    const items = ingestActionItems(sources);
    const titles = items.map((i) => i.title);
    expect(titles.some((t) => /rate limiting/i.test(t))).toBe(true);
    expect(titles.some((t) => /null deref/i.test(t))).toBe(true);
    const fixme = items.find((i) => /null deref/i.test(i.title));
    expect(fixme?.confidence).toBe('high');
    expect(fixme?.tags).toContain('bug');
  });

  it('extracts review suggestions and nits', () => {
    const sources: ActionItemSource[] = [
      { kind: 'review', ref: 'PR#42', author: 'alice', text: 'nit: rename this variable\nConsider extracting this into a helper' },
    ];
    const items = ingestActionItems(sources);
    expect(items.some((i) => i.tags.includes('nit'))).toBe(true);
    expect(items.some((i) => /helper/i.test(i.title))).toBe(true);
    expect(items.every((i) => i.source.includes('PR#42'))).toBe(true);
  });

  it('detects imperative "should/needs to" action phrasing', () => {
    const items = ingestActionItems([
      { kind: 'chat', text: 'we should migrate the config loader to zod' },
    ]);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toMatch(/migrate the config loader/i);
  });

  it('downgrades medium-confidence chat findings to low', () => {
    const items = ingestActionItems([
      { kind: 'chat', text: 'we should refactor the parser' },
    ]);
    expect(items[0].confidence).toBe('low');
  });

  it('dedupes repeated items and merges provenance', () => {
    const items = ingestActionItems([
      { kind: 'commit', ref: 'c1', text: 'TODO: add tests for the scheduler' },
      { kind: 'review', ref: 'PR#9', text: 'TODO: add tests for the scheduler' },
    ]);
    const matches = items.filter((i) => /add tests for the scheduler/i.test(i.title));
    expect(matches).toHaveLength(1);
    expect(matches[0].rationale).toContain('also');
  });

  it('respects minConfidence and limit', () => {
    const sources: ActionItemSource[] = [
      { kind: 'commit', text: 'FIXME: high one' },
      { kind: 'review', text: 'nit: low one' },
      { kind: 'commit', text: 'TODO: medium one' },
    ];
    const highOnly = ingestActionItems(sources, { minConfidence: 'high' });
    expect(highOnly.every((i) => i.confidence === 'high')).toBe(true);
    const limited = ingestActionItems(sources, { limit: 1 });
    expect(limited).toHaveLength(1);
    expect(limited[0].confidence).toBe('high'); // most confident first
  });

  it('never returns dispatchable missions — only proposals', () => {
    const items = ingestActionItems([{ kind: 'commit', text: 'TODO: something' }]);
    for (const item of items) {
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('confidence');
      expect(item).not.toHaveProperty('branch');
      expect(item).not.toHaveProperty('status');
    }
  });
});

describe('ingestFromAdapters', () => {
  it('collects from multiple adapters and tolerates a failing one', async () => {
    const good: ActionItemAdapter = {
      name: 'good',
      collect: async () => [{ kind: 'commit', text: 'TODO: ship it' }],
    };
    const bad: ActionItemAdapter = {
      name: 'bad',
      collect: async () => {
        throw new Error('boom');
      },
    };
    const items = await ingestFromAdapters([good, bad]);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toMatch(/ship it/i);
  });
});
