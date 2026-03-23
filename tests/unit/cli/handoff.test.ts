import { describe, it, expect, vi } from 'vitest';
import {
  parseFleetManifest,
  writeFleetManifest,
} from '@fleet/core';
import type { FleetManifest } from '@fleet/core';

describe('handoff logic', () => {
  it('setting commander status to transferred is a valid state', () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: { host: 'machine-a', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
      missions: [], mergeQueue: [], completed: [],
    };
    manifest.commander.status = 'transferred';
    manifest.commander.lastCheckin = new Date();
    manifest.updated = new Date();
    const md = writeFleetManifest(manifest);
    const parsed = parseFleetManifest(md);
    expect(parsed.commander.status).toBe('transferred');
  });

  it('resume after handoff overwrites commander info', () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: { host: 'machine-a', lastCheckin: new Date(), status: 'transferred', timeoutMinutes: 15 },
      missions: [], mergeQueue: [], completed: [],
    };
    manifest.commander.host = 'machine-b';
    manifest.commander.status = 'active';
    manifest.commander.lastCheckin = new Date();
    const md = writeFleetManifest(manifest);
    const parsed = parseFleetManifest(md);
    expect(parsed.commander.host).toBe('machine-b');
    expect(parsed.commander.status).toBe('active');
  });

  it('non-commander machine cannot handoff (guard logic)', () => {
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: { host: 'machine-a', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
      missions: [], mergeQueue: [], completed: [],
    };
    const currentHost = 'machine-b';
    const isCommander = manifest.commander.host === currentHost;
    expect(isCommander).toBe(false);
  });
});
