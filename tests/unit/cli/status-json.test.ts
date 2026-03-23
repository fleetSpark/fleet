import { describe, it, expect } from 'vitest';
import { formatManifestJson } from '../../../packages/cli/src/commands/status.js';
import type { FleetManifest } from '@fleetspark/core';

describe('fleet status --json', () => {
  it('outputs valid JSON with all manifest fields', () => {
    const manifest: FleetManifest = {
      updated: new Date('2026-03-23T10:00:00Z'),
      commander: { host: 'test-host', lastCheckin: new Date('2026-03-23T10:00:00Z'), status: 'active', timeoutMinutes: 15 },
      missions: [
        { id: 'M1', branch: 'feat/x', ship: 'ship-a', agent: 'claude-code', status: 'in-progress', depends: [], blocker: 'none' },
      ],
      mergeQueue: [],
      completed: [],
    };
    const json = formatManifestJson(manifest);
    const parsed = JSON.parse(json);
    expect(parsed.updated).toBe('2026-03-23T10:00:00.000Z');
    expect(parsed.commander.host).toBe('test-host');
    expect(parsed.missions).toHaveLength(1);
    expect(parsed.missions[0].id).toBe('M1');
  });

  it('serializes completed entries with ISO dates', () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: { host: 'h', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
      missions: [],
      mergeQueue: [],
      completed: [{ missionId: 'M1', branch: 'feat/x', mergedDate: new Date('2026-03-23T12:00:00Z') }],
    };
    const parsed = JSON.parse(formatManifestJson(manifest));
    expect(parsed.completed[0].mergedDate).toBe('2026-03-23T12:00:00.000Z');
  });
});
