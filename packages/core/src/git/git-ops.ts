import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

export interface PRStatus {
  state: 'open' | 'closed' | 'merged';
  mergeable: boolean;
  ciStatus: 'pending' | 'success' | 'failure' | 'none';
  hasConflicts: boolean;
  url: string;
}

export interface GitOps {
  clone(repo: string, dir: string): Promise<void>;
  checkout(branch: string): Promise<void>;
  createBranch(name: string, from?: string): Promise<void>;
  createOrphanBranch(name: string): Promise<void>;
  readFile(branch: string, path: string): Promise<string>;
  writeAndPush(
    branch: string,
    path: string,
    content: string,
    message: string
  ): Promise<void>;
  pull(branch: string): Promise<void>;
  getCurrentBranch(): Promise<string>;
  branchExists(branch: string, remote?: boolean): Promise<boolean>;
  getRemoteUrl(): Promise<string>;
  addAndCommit(paths: string[], message: string): Promise<void>;
  pushNewBranch(branch: string): Promise<void>;
  fetchBranch(branch: string): Promise<void>;
  createPR(branch: string, base: string, title: string, body: string): Promise<string>;
  getPRStatus(branch: string): Promise<PRStatus | null>;
  mergePR(branch: string, method?: 'merge' | 'squash' | 'rebase'): Promise<void>;
  diffNameOnly(base: string, head: string): Promise<string[]>;
}

export class RealGitOps implements GitOps {
  constructor(private cwd: string) {}

  private async exec(...args: string[]): Promise<string> {
    const { stdout } = await execFile('git', args, { cwd: this.cwd });
    return stdout.trim();
  }

  async clone(repo: string, dir: string): Promise<void> {
    await execFile('git', ['clone', repo, dir]);
  }

  async checkout(branch: string): Promise<void> {
    await this.exec('checkout', branch);
  }

  async createBranch(name: string, from?: string): Promise<void> {
    if (from) {
      await this.exec('checkout', '-b', name, from);
    } else {
      await this.exec('checkout', '-b', name);
    }
  }

  async createOrphanBranch(name: string): Promise<void> {
    await this.exec('checkout', '--orphan', name);
    // Remove all tracked files from the orphan branch index
    await this.exec('rm', '-rf', '.').catch(() => {});
  }

  async readFile(branch: string, path: string): Promise<string> {
    return this.exec('show', `${branch}:${path}`);
  }

  async writeAndPush(
    branch: string,
    path: string,
    content: string,
    message: string
  ): Promise<void> {
    const { writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { mkdirSync } = await import('node:fs');

    const { dirname } = await import('node:path');

    const currentBranch = await this.getCurrentBranch();
    const needsSwitch = currentBranch !== branch;

    if (needsSwitch) {
      await this.checkout(branch);
    }

    try {
      // Ensure parent directory exists (use path.dirname for cross-platform)
      const filePath = join(this.cwd, path);
      const dir = dirname(filePath);
      if (dir && dir !== this.cwd) {
        mkdirSync(dir, { recursive: true });
      }

      await writeFile(filePath, content, 'utf-8');
      await this.exec('add', path);
      await this.exec('commit', '-m', message);

      // Retry on conflict: pull --rebase then push (max 3 attempts)
      let pushed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.exec('push', 'origin', branch);
          pushed = true;
          break;
        } catch {
          await this.exec('pull', '--rebase', 'origin', branch);
        }
      }
      if (!pushed) {
        throw new Error(`Failed to push to ${branch} after 3 attempts`);
      }
    } finally {
      if (needsSwitch) {
        await this.checkout(currentBranch);
      }
    }
  }

  async pull(branch: string): Promise<void> {
    await this.exec('pull', 'origin', branch);
  }

  async getCurrentBranch(): Promise<string> {
    return this.exec('rev-parse', '--abbrev-ref', 'HEAD');
  }

  async branchExists(branch: string, remote = false): Promise<boolean> {
    try {
      const ref = remote ? `refs/remotes/origin/${branch}` : `refs/heads/${branch}`;
      await this.exec('show-ref', '--verify', ref);
      return true;
    } catch {
      return false;
    }
  }

  async getRemoteUrl(): Promise<string> {
    return this.exec('remote', 'get-url', 'origin');
  }

  async addAndCommit(paths: string[], message: string): Promise<void> {
    await this.exec('add', ...paths);
    await this.exec('commit', '-m', message);
  }

  async pushNewBranch(branch: string): Promise<void> {
    await this.exec('push', '-u', 'origin', branch);
  }

  async fetchBranch(branch: string): Promise<void> {
    await this.exec('fetch', 'origin', branch);
  }

  async createPR(branch: string, base: string, title: string, body: string): Promise<string> {
    const { stdout } = await execFile('gh', ['pr', 'create',
      '--head', branch, '--base', base,
      '--title', title, '--body', body,
    ], { cwd: this.cwd });
    return stdout.trim();
  }

  async getPRStatus(branch: string): Promise<PRStatus | null> {
    try {
      const { stdout } = await execFile('gh', ['pr', 'view', branch,
        '--json', 'state,mergeable,statusCheckRollup,url',
      ], { cwd: this.cwd });
      const data = JSON.parse(stdout);

      let ciStatus: PRStatus['ciStatus'] = 'none';
      if (data.statusCheckRollup?.length > 0) {
        const allPassed = data.statusCheckRollup.every(
          (c: any) => c.conclusion === 'SUCCESS'
        );
        const anyPending = data.statusCheckRollup.some(
          (c: any) => !c.conclusion || c.status === 'PENDING' || c.status === 'IN_PROGRESS'
        );
        if (anyPending) ciStatus = 'pending';
        else if (allPassed) ciStatus = 'success';
        else ciStatus = 'failure';
      }

      return {
        state: data.state.toLowerCase(),
        mergeable: data.mergeable !== 'CONFLICTING',
        ciStatus,
        hasConflicts: data.mergeable === 'CONFLICTING',
        url: data.url,
      };
    } catch (err) {
      // Only return null for "no PR found" — log other errors
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('no pull requests found') && !msg.includes('Could not resolve')) {
        console.error(`getPRStatus error for ${branch}: ${msg}`);
      }
      return null;
    }
  }

  async mergePR(branch: string, method: 'merge' | 'squash' | 'rebase' = 'merge'): Promise<void> {
    await execFile('gh', ['pr', 'merge', branch, `--${method}`, '--delete-branch'], { cwd: this.cwd });
  }

  async diffNameOnly(base: string, head: string): Promise<string[]> {
    const result = await this.exec('diff', '--name-only', `${base}...${head}`);
    return result ? result.split('\n').filter(Boolean) : [];
  }
}
