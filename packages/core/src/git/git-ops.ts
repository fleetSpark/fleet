import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import {
  detectProvider,
  resolveProvider,
  type GitProvider,
  type GitProviderName,
} from './providers.js';

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
  private provider: GitProvider | null = null;

  constructor(
    private cwd: string,
    /** Force a specific provider; otherwise detected from the remote URL. */
    private providerName?: GitProviderName
  ) {}

  /** Resolve (and cache) the hosting provider for PR/MR operations. */
  private async getProvider(): Promise<GitProvider> {
    if (this.provider) return this.provider;
    let name: GitProviderName = this.providerName ?? 'github';
    if (!this.providerName) {
      try {
        name = detectProvider(await this.getRemoteUrl());
      } catch {
        name = 'github';
      }
    }
    this.provider = resolveProvider(name);
    return this.provider;
  }

  private async exec(...args: string[]): Promise<string> {
    // Retry once on transient index.lock contention. Concurrent git ops
    // (e.g. ship's commit racing with a heartbeat push, or a killed
    // child process that left a stale lock) can produce
    // "fatal: Unable to create '.git/index.lock': File exists".
    // Fix is to wait briefly (the OTHER op usually finishes inside 500ms)
    // and retry. If the lock is genuinely stale (older than 30s),
    // we delete it; that's the same recovery `git` itself recommends.
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { stdout } = await execFile('git', args, { cwd: this.cwd });
        return stdout.trim();
      } catch (err) {
        lastErr = err;
        const stderr = String((err as { stderr?: string })?.stderr ?? '');
        if (!stderr.includes('index.lock')) throw err;

        // Lock-contention path
        await new Promise((r) => setTimeout(r, 500));

        // Check lock age — if it's clearly orphaned, remove it.
        try {
          const { stat, unlink } = await import('node:fs/promises');
          const { join } = await import('node:path');
          const lockPath = join(this.cwd, '.git', 'index.lock');
          const lockStat = await stat(lockPath).catch(() => null);
          if (lockStat && Date.now() - lockStat.mtimeMs > 30_000) {
            await unlink(lockPath).catch(() => {});
          }
        } catch {
          // best-effort cleanup; fall through to retry
        }
      }
    }
    throw lastErr;
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
    try {
      return await this.exec('show', `${branch}:${path}`);
    } catch (err) {
      // After a fresh `git clone`, only remote-tracking refs exist for branches
      // beyond the default HEAD. Fall back to origin/<branch> so callers that
      // only need to read state (ships, monitors, status views) don't have to
      // pre-create local tracking refs.
      return await this.exec('show', `origin/${branch}:${path}`);
    }
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

      // Retry on conflict: pull --rebase --autostash then push (max 3 attempts).
      //
      // V1.1.9: --autostash is critical. The ship's heartbeat fires writeAndPush
      // every 60s on the mission branch, while the spawned agent is independently
      // writing files to the same working tree. Without --autostash, the heartbeat's
      // pull --rebase fails the moment the agent has any unstaged changes
      // ("error: cannot pull with rebase: You have unstaged changes"), and the
      // ship process crashes mid-mission. With --autostash, git automatically
      // stash-saves uncommitted changes before the rebase + restores them after,
      // so the heartbeat coexists cleanly with the agent's in-flight edits.
      // The agent's commit (when it lands) then includes whatever it just wrote.
      let pushed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.exec('push', 'origin', branch);
          pushed = true;
          break;
        } catch {
          await this.exec('pull', '--rebase', '--autostash', 'origin', branch);
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
    const provider = await this.getProvider();
    return provider.createPR(this.cwd, branch, base, title, body);
  }

  async getPRStatus(branch: string): Promise<PRStatus | null> {
    const provider = await this.getProvider();
    return provider.getPRStatus(this.cwd, branch);
  }

  async mergePR(branch: string, method: 'merge' | 'squash' | 'rebase' = 'merge'): Promise<void> {
    const provider = await this.getProvider();
    return provider.mergePR(this.cwd, branch, method);
  }

  async diffNameOnly(base: string, head: string): Promise<string[]> {
    const result = await this.exec('diff', '--name-only', `${base}...${head}`);
    return result ? result.split('\n').filter(Boolean) : [];
  }
}
