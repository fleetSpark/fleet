import { describe, it, expect, vi } from 'vitest';
import { CommanderElection, writeFleetManifest, parseFleetManifest } from '@fleet/core';
import type { GitOps, FleetManifest, CommanderInfo } from '@fleet/core';

function createMockGitOps(overrides: Partial<GitOps> = {}): GitOps {
  return {
    clone: vi.fn(),
    checkout: vi.fn(),
    createBranch: vi.fn(),
    createOrphanBranch: vi.fn(),
    readFile: vi.fn(),
    writeAndPush: vi.fn(),
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
    ...overrides,
  };
}

function makeManifest(commanderOverrides: Partial<CommanderInfo> = {}): FleetManifest {
  return {
    updated: new Date(),
    commander: {
      host: 'node-alpha',
      lastCheckin: new Date(),
      status: 'active',
      timeoutMinutes: 15,
      ...commanderOverrides,
    },
    missions: [],
    mergeQueue: [],
    completed: [],
  };
}

describe('CommanderElection', () => {
  const election = new CommanderElection();

  describe('canClaim', () => {
    it('returns true when no commander exists', () => {
      const manifest = makeManifest({ host: '' });
      const result = election.canClaim(manifest, 'node-beta');
      expect(result.canClaim).toBe(true);
      expect(result.reason).toContain('No commander');
    });

    it('returns true when commander is timed out', () => {
      const oldCheckin = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      const manifest = makeManifest({
        host: 'node-alpha',
        lastCheckin: oldCheckin,
        timeoutMinutes: 15,
      });
      const result = election.canClaim(manifest, 'node-beta');
      expect(result.canClaim).toBe(true);
      expect(result.reason).toContain('timed out');
    });

    it('returns false when commander is active and different host', () => {
      const manifest = makeManifest({
        host: 'node-alpha',
        lastCheckin: new Date(), // just now
        status: 'active',
      });
      const result = election.canClaim(manifest, 'node-beta');
      expect(result.canClaim).toBe(false);
      expect(result.reason).toContain('node-alpha');
      expect(result.reason).toContain('active');
    });

    it('returns true when I am the current commander', () => {
      const manifest = makeManifest({ host: 'node-beta' });
      const result = election.canClaim(manifest, 'node-beta');
      expect(result.canClaim).toBe(true);
      expect(result.reason).toContain('Already');
    });

    it('returns true when commander status is offline', () => {
      const manifest = makeManifest({
        host: 'node-alpha',
        status: 'offline',
        lastCheckin: new Date(),
      });
      const result = election.canClaim(manifest, 'node-beta');
      expect(result.canClaim).toBe(true);
      expect(result.reason).toContain('offline');
    });

    it('returns true when commander status is transferred', () => {
      const manifest = makeManifest({
        host: 'node-alpha',
        status: 'transferred',
        lastCheckin: new Date(),
      });
      const result = election.canClaim(manifest, 'node-beta');
      expect(result.canClaim).toBe(true);
      expect(result.reason).toContain('transferred');
    });
  });

  describe('claim', () => {
    it('writes commander info to fleet/state on successful claim', async () => {
      const manifest = makeManifest({ host: '', status: 'offline' });
      const manifestMd = writeFleetManifest(manifest);

      const git = createMockGitOps();
      (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(manifestMd);
      (git.writeAndPush as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const result = await election.claim(git, 'node-beta');

      expect(result).toBe(true);
      expect(git.writeAndPush).toHaveBeenCalledWith(
        'fleet/state',
        'FLEET.md',
        expect.stringContaining('node-beta'),
        expect.stringContaining('node-beta')
      );

      // Verify the written content has correct commander info
      const writtenContent = (git.writeAndPush as ReturnType<typeof vi.fn>).mock.calls[0][2];
      const writtenManifest = parseFleetManifest(writtenContent);
      expect(writtenManifest.commander.host).toBe('node-beta');
      expect(writtenManifest.commander.status).toBe('active');
    });

    it('returns false when commander is active and different host', async () => {
      const manifest = makeManifest({
        host: 'node-alpha',
        lastCheckin: new Date(),
        status: 'active',
      });
      const manifestMd = writeFleetManifest(manifest);

      const git = createMockGitOps();
      (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(manifestMd);

      const result = await election.claim(git, 'node-beta');

      expect(result).toBe(false);
      expect(git.writeAndPush).not.toHaveBeenCalled();
    });

    it('returns false when push fails (another node won)', async () => {
      const manifest = makeManifest({ host: '' });
      const manifestMd = writeFleetManifest(manifest);

      const git = createMockGitOps();
      (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(manifestMd);
      (git.writeAndPush as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('push conflict')
      );

      const result = await election.claim(git, 'node-beta');

      expect(result).toBe(false);
    });
  });

  describe('heartbeat', () => {
    it('updates checkin timestamp for current commander', async () => {
      const manifest = makeManifest({ host: 'node-beta' });
      const manifestMd = writeFleetManifest(manifest);

      const git = createMockGitOps();
      (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(manifestMd);
      (git.writeAndPush as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await election.heartbeat(git, 'node-beta');

      expect(git.writeAndPush).toHaveBeenCalledWith(
        'fleet/state',
        'FLEET.md',
        expect.any(String),
        expect.stringContaining('heartbeat')
      );
    });

    it('throws when host is not the current commander', async () => {
      const manifest = makeManifest({ host: 'node-alpha' });
      const manifestMd = writeFleetManifest(manifest);

      const git = createMockGitOps();
      (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(manifestMd);

      await expect(election.heartbeat(git, 'node-beta')).rejects.toThrow(
        'Cannot heartbeat'
      );
    });
  });

  describe('release', () => {
    it('sets commander status to offline', async () => {
      const manifest = makeManifest({ host: 'node-beta' });
      const manifestMd = writeFleetManifest(manifest);

      const git = createMockGitOps();
      (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(manifestMd);
      (git.writeAndPush as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await election.release(git, 'node-beta');

      const writtenContent = (git.writeAndPush as ReturnType<typeof vi.fn>).mock.calls[0][2];
      const writtenManifest = parseFleetManifest(writtenContent);
      expect(writtenManifest.commander.status).toBe('offline');
    });

    it('throws when host is not the current commander', async () => {
      const manifest = makeManifest({ host: 'node-alpha' });
      const manifestMd = writeFleetManifest(manifest);

      const git = createMockGitOps();
      (git.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(manifestMd);

      await expect(election.release(git, 'node-beta')).rejects.toThrow(
        'Cannot release'
      );
    });
  });
});
