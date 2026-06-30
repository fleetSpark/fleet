/**
 * Team Lite — the Git-native ownership/approval layer for "Fleet for Teams".
 * Lives in an optional companion file (`.fleet/team.yml`) so solo fleets are
 * unaffected. Provides ownership lanes, reviewer routing, and role-aware merge
 * approval policy without any hosted infrastructure.
 */

export type Role = 'owner' | 'reviewer' | 'maintainer' | 'contributor';

export interface TeamMember {
  name: string;
  roles: Role[];
}

export interface OwnershipRule {
  /** Glob over repository paths (e.g. `packages/core/**`, `*.md`). */
  pattern: string;
  owner: string;
  reviewers?: string[];
}

export interface ApprovalPolicy {
  /** Minimum number of distinct reviewer approvals. Default 1. */
  minReviewers?: number;
  /** Require the matched path owner to be among the approvals. Default false. */
  requireOwner?: boolean;
}

export interface TeamConfig {
  members: TeamMember[];
  ownership: OwnershipRule[];
  approval: ApprovalPolicy;
}

export function parseTeamConfig(raw: unknown): TeamConfig {
  const obj = (raw ?? {}) as Partial<TeamConfig>;
  const members: TeamMember[] = Array.isArray(obj.members)
    ? obj.members
        .filter((m): m is TeamMember => !!m && typeof (m as TeamMember).name === 'string')
        .map((m) => ({ name: m.name, roles: Array.isArray(m.roles) ? m.roles : [] }))
    : [];
  const ownership: OwnershipRule[] = Array.isArray(obj.ownership)
    ? obj.ownership
        .filter((r): r is OwnershipRule => !!r && typeof (r as OwnershipRule).pattern === 'string' && typeof (r as OwnershipRule).owner === 'string')
        .map((r) => ({ pattern: r.pattern, owner: r.owner, ...(r.reviewers ? { reviewers: r.reviewers } : {}) }))
    : [];
  const approval: ApprovalPolicy = {
    minReviewers: obj.approval?.minReviewers ?? 1,
    requireOwner: obj.approval?.requireOwner ?? false,
  };
  return { members, ownership, approval };
}

/** Convert a simple glob (`*`, `**`, `?`) into an anchored RegExp. */
export function globToRegExp(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // `**` matches across path separators
        re += '.*';
        i++;
        if (pattern[i + 1] === '/') i++; // consume the slash after **/
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesPattern(pattern: string, file: string): boolean {
  return globToRegExp(pattern).test(file);
}

export interface ReviewRouting {
  owner: string | null;
  reviewers: string[];
  /** Files that matched no ownership rule. */
  unowned: string[];
}

/**
 * Route a set of changed files to an owner and reviewers using the first
 * matching ownership rule per file. The most-specific (longest-pattern) match
 * wins for the primary owner.
 */
export function routeReviewers(team: TeamConfig, files: string[]): ReviewRouting {
  const reviewers = new Set<string>();
  const unowned: string[] = [];
  const ownerMatches: Array<{ owner: string; specificity: number }> = [];

  for (const file of files) {
    const rule = bestRule(team.ownership, file);
    if (!rule) {
      unowned.push(file);
      continue;
    }
    ownerMatches.push({ owner: rule.owner, specificity: rule.pattern.length });
    for (const r of rule.reviewers ?? []) reviewers.add(r);
  }

  ownerMatches.sort((a, b) => b.specificity - a.specificity);
  const owner = ownerMatches[0]?.owner ?? null;
  // The owner can also count as a reviewer candidate but is reported separately.
  reviewers.delete(owner ?? '');

  return { owner, reviewers: [...reviewers], unowned };
}

function bestRule(rules: OwnershipRule[], file: string): OwnershipRule | null {
  let best: OwnershipRule | null = null;
  for (const rule of rules) {
    if (matchesPattern(rule.pattern, file)) {
      if (!best || rule.pattern.length > best.pattern.length) best = rule;
    }
  }
  return best;
}

export interface ApprovalResult {
  approved: boolean;
  /** Human-readable reasons the approval is not yet satisfied. */
  missing: string[];
  owner: string | null;
  requiredReviewers: number;
  gotReviewers: number;
}

/**
 * Evaluate whether the given approvals satisfy the team's merge policy for the
 * changed files. Used as a human-in-the-loop gate before the merge commander
 * proceeds.
 */
export function evaluateApproval(
  team: TeamConfig,
  approvals: string[],
  files: string[]
): ApprovalResult {
  const routing = routeReviewers(team, files);
  const approvalSet = new Set(approvals);
  const missing: string[] = [];

  const minReviewers = team.approval.minReviewers ?? 1;
  const distinctApprovers = approvalSet.size;
  if (distinctApprovers < minReviewers) {
    missing.push(`needs ${minReviewers} reviewer approval(s), have ${distinctApprovers}`);
  }

  if (team.approval.requireOwner) {
    if (!routing.owner) {
      missing.push('no owner could be determined for the changed files');
    } else if (!approvalSet.has(routing.owner)) {
      missing.push(`owner "${routing.owner}" has not approved`);
    }
  }

  return {
    approved: missing.length === 0,
    missing,
    owner: routing.owner,
    requiredReviewers: minReviewers,
    gotReviewers: distinctApprovers,
  };
}
