import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BriefGenerator } from '@fleet/core';
import type { GitOps } from '@fleet/core';

function createMockGitOps(overrides: Partial<GitOps> = {}): GitOps {
  return {
    clone: vi.fn(), checkout: vi.fn(), createBranch: vi.fn(), createOrphanBranch: vi.fn(),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    writeAndPush: vi.fn(), pull: vi.fn(), getCurrentBranch: vi.fn(),
    branchExists: vi.fn().mockResolvedValue(false),
    getRemoteUrl: vi.fn(), addAndCommit: vi.fn(), pushNewBranch: vi.fn(),
    fetchBranch: vi.fn(), createPR: vi.fn(), getPRStatus: vi.fn(), mergePR: vi.fn(),
    ...overrides,
  };
}

describe('BriefGenerator', () => {
  it('generates static brief with header and timestamp', async () => {
    const git = createMockGitOps();
    const gen = new BriefGenerator(git);
    const result = await gen.generate('/fake/repo', { llm: false });
    expect(result).toContain('# Fleet Context');
    expect(result).toContain('Generated:');
    expect(result).toContain('## Architecture overview');
    expect(result).toContain('## Key directories');
  });

  it('includes package.json dependencies when found', async () => {
    const git = createMockGitOps();
    const gen = new BriefGenerator(git);
    const mockPkg = JSON.stringify({
      name: 'test-app',
      dependencies: { express: '^4.0.0', react: '^18.0.0' },
      devDependencies: { vitest: '^3.0.0' },
    });
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'brief-test-'));
    await writeFile(join(dir, 'package.json'), mockPkg);
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.ts'), 'console.log("hello")');
    const result = await gen.generate(dir, { llm: false });
    expect(result).toContain('express');
    expect(result).toContain('react');
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  });

  it('includes active branches from FLEET.md when available', async () => {
    const fleetMd = `# FLEET.md\nUpdated: 2026-03-23T10:00:00Z\n\n## Commander\n- Host: test-host\n- Last Checkin: 2026-03-23T10:00:00Z\n- Status: active\n- Timeout: 15 min\n\n## Missions\n| ID | Branch | Ship | Agent | Status | Depends | Blocker |\n|----|--------|------|-------|--------|---------|----------|\n| M1 | feature/auth | ship-a | claude-code | in-progress | — | none |\n| M2 | feature/db | — | claude-code | ready | M1 | none |\n\n## Merge Queue\n(empty)\n\n## Completed\n(none)`;
    const git = createMockGitOps({
      branchExists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue(fleetMd),
    });
    const gen = new BriefGenerator(git);
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'brief-test-'));
    await writeFile(join(dir, 'package.json'), '{}');
    const result = await gen.generate(dir, { llm: false });
    expect(result).toContain('## Active branches');
    expect(result).toContain('feature/auth');
    expect(result).toContain('in-progress');
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  });

  it('includes do-not-touch section for in-progress branches', async () => {
    const fleetMd = `# FLEET.md\nUpdated: 2026-03-23T10:00:00Z\n\n## Commander\n- Host: test-host\n- Last Checkin: 2026-03-23T10:00:00Z\n- Status: active\n- Timeout: 15 min\n\n## Missions\n| ID | Branch | Ship | Agent | Status | Depends | Blocker |\n|----|--------|------|-------|--------|---------|----------|\n| M1 | feature/auth | ship-a | claude-code | in-progress | — | none |\n\n## Merge Queue\n(empty)\n\n## Completed\n(none)`;
    const git = createMockGitOps({
      branchExists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue(fleetMd),
    });
    const gen = new BriefGenerator(git);
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'brief-test-'));
    await writeFile(join(dir, 'package.json'), '{}');
    const result = await gen.generate(dir, { llm: false });
    expect(result).toContain('## Do-not-touch');
    expect(result).toContain('feature/auth');
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  });
});
