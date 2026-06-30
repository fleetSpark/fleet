import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LivenessPublisher,
  parsePresence,
  serializePresence,
  presencePath,
  sanitizeHost,
  isPresenceAlive,
} from '@fleetspark/core';
import type { GitOps, Presence } from '@fleetspark/core';

function mockGitOps(): GitOps {
  return {
    clone: vi.fn(),
    checkout: vi.fn(),
    createBranch: vi.fn(),
    createOrphanBranch: vi.fn(),
    readFile: vi.fn(),
    writeAndPush: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn(),
    getCurrentBranch: vi.fn(),
    branchExists: vi.fn(),
    getRemoteUrl: vi.fn(),
    addAndCommit: vi.fn(),
    pushNewBranch: vi.fn(),
    fetchBranch: vi.fn(),
    createPR: vi.fn(),
    getPRStatus: vi.fn(),
    mergePR: vi.fn(),
    diffNameOnly: vi.fn(),
  } as unknown as GitOps;
}

describe('presence path helpers', () => {
  it('sanitizes hostnames into safe stems', () => {
    expect(sanitizeHost('Dev Box 01!')).toBe('dev-box-01');
    expect(sanitizeHost('  ')).toBe('unknown-host');
    expect(presencePath('My.Laptop')).toBe('presence/my.laptop.json');
  });

  it('round-trips a presence record', () => {
    const p: Presence = { host: 'box', mode: 'manual', status: 'alive', lastSeen: '2026-06-01T10:00:00.000Z' };
    expect(parsePresence(serializePresence(p))).toEqual(p);
  });

  it('defaults an unknown mode to mission and rejects malformed records', () => {
    const parsed = parsePresence(JSON.stringify({ host: 'box', mode: 'weird', lastSeen: 'x' }));
    expect(parsed.mode).toBe('mission');
    expect(() => parsePresence(JSON.stringify({ mode: 'manual' }))).toThrow();
  });
});

describe('isPresenceAlive', () => {
  const now = new Date('2026-06-01T10:05:00Z');
  it('is alive within the stale window', () => {
    const p: Presence = { host: 'b', mode: 'manual', status: 'alive', lastSeen: '2026-06-01T10:04:00Z' };
    expect(isPresenceAlive(p, 180, now)).toBe(true);
  });
  it('is dark past the stale window', () => {
    const p: Presence = { host: 'b', mode: 'manual', status: 'alive', lastSeen: '2026-06-01T10:00:00Z' };
    expect(isPresenceAlive(p, 180, now)).toBe(false);
  });
  it('treats an unparseable timestamp as not alive', () => {
    const p: Presence = { host: 'b', mode: 'manual', status: 'alive', lastSeen: 'nope' };
    expect(isPresenceAlive(p, 180, now)).toBe(false);
  });
});

describe('LivenessPublisher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('publishes a presence file to fleet/state on publishOnce', async () => {
    const git = mockGitOps();
    const pub = new LivenessPublisher(git, { host: 'commander-box', mode: 'manual', intervalSeconds: 60 });
    const presence = await pub.publishOnce();

    expect(presence.host).toBe('commander-box');
    expect(presence.mode).toBe('manual');
    expect(git.writeAndPush).toHaveBeenCalledWith(
      'fleet/state',
      'presence/commander-box.json',
      expect.stringContaining('"mode": "manual"'),
      expect.stringContaining('heartbeat'),
    );
  });

  it('publishes immediately on start then on each interval', async () => {
    const git = mockGitOps();
    const pub = new LivenessPublisher(git, { host: 'box', mode: 'mission', intervalSeconds: 30 });
    pub.start();
    await vi.advanceTimersByTimeAsync(0); // flush immediate publish
    expect(git.writeAndPush).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(git.writeAndPush).toHaveBeenCalledTimes(3);
    pub.stop();
  });

  it('stops publishing after stop()', async () => {
    const git = mockGitOps();
    const pub = new LivenessPublisher(git, { host: 'box', mode: 'manual', intervalSeconds: 30 });
    pub.start();
    await vi.advanceTimersByTimeAsync(0);
    pub.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(git.writeAndPush).toHaveBeenCalledTimes(1);
  });
});
