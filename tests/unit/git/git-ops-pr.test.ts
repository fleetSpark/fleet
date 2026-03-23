import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('GitOps PR interface', () => {
  it('GitOps interface includes createPR method', async () => {
    const { RealGitOps } = await import('@fleetspark/core');
    const git = new RealGitOps('/tmp');
    expect(typeof git.createPR).toBe('function');
  });

  it('GitOps interface includes getPRStatus method', async () => {
    const { RealGitOps } = await import('@fleetspark/core');
    const git = new RealGitOps('/tmp');
    expect(typeof git.getPRStatus).toBe('function');
  });

  it('GitOps interface includes mergePR method', async () => {
    const { RealGitOps } = await import('@fleetspark/core');
    const git = new RealGitOps('/tmp');
    expect(typeof git.mergePR).toBe('function');
  });

  it('GitOps interface includes fetchBranch method', async () => {
    const { RealGitOps } = await import('@fleetspark/core');
    const git = new RealGitOps('/tmp');
    expect(typeof git.fetchBranch).toBe('function');
  });
});
