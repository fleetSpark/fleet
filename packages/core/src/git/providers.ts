import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { PRStatus } from './git-ops.js';

const execFile = promisify(execFileCb);

export type GitProviderName = 'github' | 'gitlab' | 'bitbucket';

/**
 * Provider-specific pull/merge-request operations. RealGitOps delegates here so
 * Fleet works against GitHub, GitLab, or Bitbucket without changing the merge
 * commander. Each method is stateless and takes the repo working dir.
 */
export interface GitProvider {
  name: GitProviderName;
  createPR(cwd: string, branch: string, base: string, title: string, body: string): Promise<string>;
  getPRStatus(cwd: string, branch: string): Promise<PRStatus | null>;
  mergePR(cwd: string, branch: string, method: 'merge' | 'squash' | 'rebase'): Promise<void>;
}

/** Detect the hosting provider from a git remote URL. Defaults to GitHub. */
export function detectProvider(remoteUrl: string): GitProviderName {
  const url = remoteUrl.toLowerCase();
  if (url.includes('gitlab')) return 'gitlab';
  if (url.includes('bitbucket')) return 'bitbucket';
  return 'github';
}

// --- GitHub (gh CLI) — preserves the original RealGitOps behavior ---

export class GitHubProvider implements GitProvider {
  name: GitProviderName = 'github';

  async createPR(cwd: string, branch: string, base: string, title: string, body: string): Promise<string> {
    const { stdout } = await execFile(
      'gh',
      ['pr', 'create', '--head', branch, '--base', base, '--title', title, '--body', body],
      { cwd }
    );
    return stdout.trim();
  }

  async getPRStatus(cwd: string, branch: string): Promise<PRStatus | null> {
    try {
      const { stdout } = await execFile(
        'gh',
        ['pr', 'view', branch, '--json', 'state,mergeable,statusCheckRollup,url'],
        { cwd }
      );
      const data = JSON.parse(stdout);
      return {
        state: data.state.toLowerCase(),
        mergeable: data.mergeable !== 'CONFLICTING',
        ciStatus: rollupToCiStatus(data.statusCheckRollup),
        hasConflicts: data.mergeable === 'CONFLICTING',
        url: data.url,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('no pull requests found') && !msg.includes('Could not resolve')) {
        console.error(`getPRStatus error for ${branch}: ${msg}`);
      }
      return null;
    }
  }

  async mergePR(cwd: string, branch: string, method: 'merge' | 'squash' | 'rebase'): Promise<void> {
    await execFile('gh', ['pr', 'merge', branch, `--${method}`, '--delete-branch'], { cwd });
  }
}

/** Map GitHub's statusCheckRollup array to a normalized CI status. */
export function rollupToCiStatus(rollup: unknown): PRStatus['ciStatus'] {
  if (!Array.isArray(rollup) || rollup.length === 0) return 'none';
  const anyPending = rollup.some(
    (c: { conclusion?: string; status?: string }) =>
      !c.conclusion || c.status === 'PENDING' || c.status === 'IN_PROGRESS'
  );
  if (anyPending) return 'pending';
  const allPassed = rollup.every((c: { conclusion?: string }) => c.conclusion === 'SUCCESS');
  return allPassed ? 'success' : 'failure';
}

// --- GitLab (glab CLI) ---

export class GitLabProvider implements GitProvider {
  name: GitProviderName = 'gitlab';

  async createPR(cwd: string, branch: string, base: string, title: string, body: string): Promise<string> {
    const { stdout } = await execFile(
      'glab',
      ['mr', 'create', '--source-branch', branch, '--target-branch', base, '--title', title, '--description', body, '--yes'],
      { cwd }
    );
    return extractUrl(stdout) ?? stdout.trim();
  }

  async getPRStatus(cwd: string, branch: string): Promise<PRStatus | null> {
    try {
      const { stdout } = await execFile('glab', ['mr', 'view', branch, '--output', 'json'], { cwd });
      const data = JSON.parse(stdout);
      const merged = data.state === 'merged';
      const hasConflicts = data.has_conflicts === true || data.merge_status === 'cannot_be_merged';
      return {
        state: merged ? 'merged' : data.state === 'closed' ? 'closed' : 'open',
        mergeable: !hasConflicts,
        ciStatus: gitlabPipelineToCiStatus(data.pipeline?.status ?? data.head_pipeline?.status),
        hasConflicts,
        url: data.web_url ?? '',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/not found|no open/i.test(msg)) {
        console.error(`getPRStatus (gitlab) error for ${branch}: ${msg}`);
      }
      return null;
    }
  }

  async mergePR(cwd: string, branch: string, method: 'merge' | 'squash' | 'rebase'): Promise<void> {
    const args = ['mr', 'merge', branch, '--yes', '--remove-source-branch'];
    if (method === 'squash') args.push('--squash');
    if (method === 'rebase') args.push('--rebase');
    await execFile('glab', args, { cwd });
  }
}

export function gitlabPipelineToCiStatus(status: string | undefined): PRStatus['ciStatus'] {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'failure';
    case undefined:
    case null:
    case '':
      return 'none';
    default:
      // running, pending, created, preparing, scheduled, manual…
      return 'pending';
  }
}

// --- Bitbucket (REST API via fetch) ---

export class BitbucketProvider implements GitProvider {
  name: GitProviderName = 'bitbucket';

  /**
   * Bitbucket has no ubiquitous CLI, so we use the REST API. Requires
   * BITBUCKET_WORKSPACE, BITBUCKET_REPO, and BITBUCKET_TOKEN in the env.
   */
  private apiBase(): { base: string; headers: Record<string, string> } {
    const ws = process.env.BITBUCKET_WORKSPACE;
    const repo = process.env.BITBUCKET_REPO;
    const token = process.env.BITBUCKET_TOKEN;
    if (!ws || !repo || !token) {
      throw new Error(
        'Bitbucket provider requires BITBUCKET_WORKSPACE, BITBUCKET_REPO, and BITBUCKET_TOKEN env vars'
      );
    }
    return {
      base: `https://api.bitbucket.org/2.0/repositories/${ws}/${repo}`,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
  }

  async createPR(_cwd: string, branch: string, base: string, title: string, body: string): Promise<string> {
    const { base: api, headers } = this.apiBase();
    const res = await fetch(`${api}/pullrequests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        description: body,
        source: { branch: { name: branch } },
        destination: { branch: { name: base } },
        close_source_branch: true,
      }),
    });
    if (!res.ok) throw new Error(`Bitbucket createPR failed: ${res.status}`);
    const data = (await res.json()) as { links?: { html?: { href?: string } } };
    return data.links?.html?.href ?? '';
  }

  async getPRStatus(_cwd: string, branch: string): Promise<PRStatus | null> {
    const { base: api, headers } = this.apiBase();
    const res = await fetch(`${api}/pullrequests?q=source.branch.name="${encodeURIComponent(branch)}"`, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as { values?: Array<{ id: number; state: string; links?: { html?: { href?: string } } }> };
    const pr = data.values?.[0];
    if (!pr) return null;
    const state = pr.state === 'MERGED' ? 'merged' : pr.state === 'DECLINED' ? 'closed' : 'open';
    return {
      state,
      mergeable: true,
      ciStatus: 'none',
      hasConflicts: false,
      url: pr.links?.html?.href ?? '',
    };
  }

  async mergePR(_cwd: string, branch: string, _method: 'merge' | 'squash' | 'rebase'): Promise<void> {
    const { base: api, headers } = this.apiBase();
    const status = await this.getPRStatusRaw(api, headers, branch);
    if (!status) throw new Error(`No Bitbucket PR found for branch ${branch}`);
    const res = await fetch(`${api}/pullrequests/${status.id}/merge`, { method: 'POST', headers });
    if (!res.ok) throw new Error(`Bitbucket mergePR failed: ${res.status}`);
  }

  private async getPRStatusRaw(api: string, headers: Record<string, string>, branch: string) {
    const res = await fetch(`${api}/pullrequests?q=source.branch.name="${encodeURIComponent(branch)}"`, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as { values?: Array<{ id: number }> };
    return data.values?.[0] ?? null;
  }
}

const PROVIDERS: Record<GitProviderName, () => GitProvider> = {
  github: () => new GitHubProvider(),
  gitlab: () => new GitLabProvider(),
  bitbucket: () => new BitbucketProvider(),
};

export function resolveProvider(name: GitProviderName): GitProvider {
  return PROVIDERS[name]();
}

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0] : null;
}
