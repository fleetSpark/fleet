import { describe, it, expect } from 'vitest';
import {
  parseTeamConfig,
  routeReviewers,
  evaluateApproval,
  matchesPattern,
} from '@fleetspark/core';

const teamRaw = {
  members: [
    { name: 'alice', roles: ['owner', 'maintainer'] },
    { name: 'bob', roles: ['reviewer'] },
    { name: 'carol', roles: ['reviewer'] },
  ],
  ownership: [
    { pattern: 'packages/core/**', owner: 'alice', reviewers: ['bob'] },
    { pattern: 'packages/**', owner: 'bob', reviewers: ['carol'] },
    { pattern: '*.md', owner: 'carol' },
  ],
  approval: { minReviewers: 2, requireOwner: true },
};

describe('matchesPattern', () => {
  it('matches ** across path separators', () => {
    expect(matchesPattern('packages/core/**', 'packages/core/src/index.ts')).toBe(true);
    expect(matchesPattern('packages/core/**', 'packages/cli/x.ts')).toBe(false);
  });
  it('matches * within a single segment', () => {
    expect(matchesPattern('*.md', 'README.md')).toBe(true);
    expect(matchesPattern('*.md', 'docs/README.md')).toBe(false);
  });
});

describe('parseTeamConfig', () => {
  it('parses members, ownership, and approval with defaults', () => {
    const team = parseTeamConfig(teamRaw);
    expect(team.members).toHaveLength(3);
    expect(team.ownership).toHaveLength(3);
    expect(team.approval.minReviewers).toBe(2);
    expect(team.approval.requireOwner).toBe(true);
  });
  it('applies defaults for an empty config', () => {
    const team = parseTeamConfig({});
    expect(team.members).toEqual([]);
    expect(team.approval.minReviewers).toBe(1);
    expect(team.approval.requireOwner).toBe(false);
  });
});

describe('routeReviewers', () => {
  const team = parseTeamConfig(teamRaw);
  it('routes to the most-specific owner and collects reviewers', () => {
    const routing = routeReviewers(team, ['packages/core/src/a.ts']);
    expect(routing.owner).toBe('alice'); // most specific lane
    expect(routing.reviewers).toContain('bob');
  });
  it('reports unowned files', () => {
    const routing = routeReviewers(team, ['scripts/deploy.sh']);
    expect(routing.owner).toBeNull();
    expect(routing.unowned).toContain('scripts/deploy.sh');
  });
  it('does not list the owner as their own reviewer', () => {
    const routing = routeReviewers(team, ['packages/core/src/a.ts']);
    expect(routing.reviewers).not.toContain('alice');
  });
});

describe('evaluateApproval', () => {
  const team = parseTeamConfig(teamRaw);
  const files = ['packages/core/src/a.ts'];

  it('blocks when below min reviewers', () => {
    const r = evaluateApproval(team, ['bob'], files);
    expect(r.approved).toBe(false);
    expect(r.missing.join(' ')).toContain('reviewer');
  });

  it('blocks when owner has not approved and requireOwner is set', () => {
    const r = evaluateApproval(team, ['bob', 'carol'], files);
    expect(r.approved).toBe(false);
    expect(r.missing.join(' ')).toContain('owner "alice"');
  });

  it('approves when policy is satisfied', () => {
    const r = evaluateApproval(team, ['alice', 'bob'], files);
    expect(r.approved).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('does not require owner when policy disables it', () => {
    const lenient = parseTeamConfig({ ...teamRaw, approval: { minReviewers: 1, requireOwner: false } });
    const r = evaluateApproval(lenient, ['bob'], files);
    expect(r.approved).toBe(true);
  });
});
