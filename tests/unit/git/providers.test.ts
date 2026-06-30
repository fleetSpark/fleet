import { describe, it, expect } from 'vitest';
import {
  detectProvider,
  resolveProvider,
  rollupToCiStatus,
  gitlabPipelineToCiStatus,
} from '@fleetspark/core';

describe('detectProvider', () => {
  it('detects GitHub from https and ssh remotes', () => {
    expect(detectProvider('https://github.com/acme/repo.git')).toBe('github');
    expect(detectProvider('git@github.com:acme/repo.git')).toBe('github');
  });
  it('detects GitLab', () => {
    expect(detectProvider('https://gitlab.com/acme/repo.git')).toBe('gitlab');
    expect(detectProvider('git@gitlab.example.com:acme/repo.git')).toBe('gitlab');
  });
  it('detects Bitbucket', () => {
    expect(detectProvider('https://bitbucket.org/acme/repo.git')).toBe('bitbucket');
  });
  it('defaults to GitHub for unknown hosts', () => {
    expect(detectProvider('https://example.com/acme/repo.git')).toBe('github');
  });
});

describe('resolveProvider', () => {
  it('returns a provider instance with the right name', () => {
    expect(resolveProvider('github').name).toBe('github');
    expect(resolveProvider('gitlab').name).toBe('gitlab');
    expect(resolveProvider('bitbucket').name).toBe('bitbucket');
  });
});

describe('rollupToCiStatus (GitHub)', () => {
  it('returns none for empty rollup', () => {
    expect(rollupToCiStatus([])).toBe('none');
    expect(rollupToCiStatus(undefined)).toBe('none');
  });
  it('returns pending when an in-progress check carries a conclusion (IN_PROGRESS branch)', () => {
    // Every element has a truthy conclusion, so `!c.conclusion` is false for all;
    // 'pending' can only come from the `status === 'IN_PROGRESS'` clause.
    expect(rollupToCiStatus([{ status: 'IN_PROGRESS', conclusion: 'SUCCESS' }, { conclusion: 'SUCCESS' }])).toBe('pending');
  });

  it('returns pending for the PENDING status branch', () => {
    expect(rollupToCiStatus([{ status: 'PENDING', conclusion: 'SUCCESS' }, { conclusion: 'SUCCESS' }])).toBe('pending');
  });

  it('returns pending when a check has no conclusion yet', () => {
    expect(rollupToCiStatus([{ status: 'IN_PROGRESS' }, { conclusion: 'SUCCESS' }])).toBe('pending');
  });
  it('returns success when all checks pass', () => {
    expect(rollupToCiStatus([{ conclusion: 'SUCCESS' }, { conclusion: 'SUCCESS' }])).toBe('success');
  });
  it('returns failure when a check fails', () => {
    expect(rollupToCiStatus([{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }])).toBe('failure');
  });
});

describe('gitlabPipelineToCiStatus', () => {
  it('maps GitLab pipeline statuses', () => {
    expect(gitlabPipelineToCiStatus('success')).toBe('success');
    expect(gitlabPipelineToCiStatus('failed')).toBe('failure');
    expect(gitlabPipelineToCiStatus('running')).toBe('pending');
    expect(gitlabPipelineToCiStatus(undefined)).toBe('none');
  });
});
