import { describe, it, expect, vi } from 'vitest';
import { MergeCommander } from '@fleet/core';
import type { GitOps, FleetManifest } from '@fleet/core';

describe('monitor loop merge integration', () => {
  it('MergeCommander accepts config from fleet config schema', () => {
    const mockGit = {} as GitOps;
    const mc = new MergeCommander(mockGit, {
      ciRequired: true,
      autoRebase: true,
    });
    expect(mc).toBeInstanceOf(MergeCommander);
  });

  it('MergeCommander.tick returns empty array when no actionable missions', async () => {
    const mockGit = {
      getPRStatus: vi.fn().mockResolvedValue(null),
      createPR: vi.fn(),
    } as unknown as GitOps;
    const mc = new MergeCommander(mockGit, { ciRequired: true, autoRebase: true });
    const manifest: FleetManifest = {
      updated: new Date(),
      commander: { host: 'test', lastCheckin: new Date(), status: 'active', timeoutMinutes: 15 },
      missions: [
        { id: 'M1', branch: 'feat/x', ship: 'ship-a', agent: 'claude-code', status: 'in-progress', depends: [], blocker: 'none' },
      ],
      mergeQueue: [],
      completed: [],
    };
    const results = await mc.tick(manifest);
    expect(results).toHaveLength(0);
  });
});
