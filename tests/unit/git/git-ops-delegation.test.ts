import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:child_process so RealGitOps' git calls and the providers' gh/glab
// calls are intercepted. promisify(execFile) invokes our mock with a trailing
// callback; we route by command and resolve `{ stdout }`. Unmatched calls
// resolve to empty output (never throw — a throw would surface as an unhandled
// rejection for any incidental execFile probe).
const execFileMock = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (cmd: string, args: string[], opts: unknown, cb: (e: unknown, r?: unknown) => void) => {
    let result: unknown = { stdout: '' };
    try {
      result = execFileMock(cmd, args, opts);
    } catch {
      result = { stdout: '' };
    }
    cb(null, result ?? { stdout: '' });
  },
}));

function callsTo(cmd: string): Array<[string, string[], unknown]> {
  return execFileMock.mock.calls.filter((c) => c[0] === cmd) as Array<[string, string[], unknown]>;
}

beforeEach(() => execFileMock.mockReset());

describe('RealGitOps provider delegation', () => {
  it('detects GitLab from the remote URL and forwards cwd/args to glab', async () => {
    const { RealGitOps } = await import('@fleetspark/core');
    execFileMock.mockImplementation((cmd: string, args?: string[]) => {
      if (cmd === 'git' && args?.[0] === 'remote') return { stdout: 'https://gitlab.com/acme/repo.git\n' };
      if (cmd === 'glab' && args?.[0] === 'mr' && args?.[1] === 'create')
        return { stdout: 'https://gitlab.com/acme/repo/-/merge_requests/1\n' };
      return { stdout: '' };
    });

    const ops = new RealGitOps('/work/repo');
    const url = await ops.createPR('feat', 'main', 'Title', 'Body');

    const glabCalls = callsTo('glab');
    expect(glabCalls.length).toBe(1);
    expect(glabCalls[0][2]).toMatchObject({ cwd: '/work/repo' }); // cwd forwarded
    expect(glabCalls[0][1]).toEqual(
      expect.arrayContaining(['mr', 'create', '--source-branch', 'feat', '--target-branch', 'main']),
    );
    expect(url).toContain('merge_requests/1');
    // It must NOT have shelled out to gh for a GitLab remote.
    expect(callsTo('gh').length).toBe(0);
  });

  it('uses gh for a GitHub remote', async () => {
    const { RealGitOps } = await import('@fleetspark/core');
    execFileMock.mockImplementation((cmd: string, args?: string[]) => {
      if (cmd === 'git' && args?.[0] === 'remote') return { stdout: 'git@github.com:acme/repo.git\n' };
      if (cmd === 'gh' && args?.[0] === 'pr' && args?.[1] === 'create')
        return { stdout: 'https://github.com/acme/repo/pull/1\n' };
      return { stdout: '' };
    });

    const ops = new RealGitOps('/work/repo');
    const url = await ops.createPR('feat', 'main', 'Title', 'Body');

    expect(callsTo('gh').length).toBeGreaterThan(0);
    expect(callsTo('glab').length).toBe(0);
    expect(url).toContain('pull/1');
  });

  it('honors an explicit provider override without consulting the remote URL', async () => {
    const { RealGitOps } = await import('@fleetspark/core');
    execFileMock.mockImplementation((cmd: string, args?: string[]) => {
      if (cmd === 'gh' && args?.[0] === 'pr' && args?.[1] === 'merge') return { stdout: '' };
      return { stdout: '' };
    });

    const ops = new RealGitOps('/work/repo', 'github');
    await ops.mergePR('feat', 'squash');

    // No `git remote get-url` lookup when the provider is forced.
    expect(execFileMock.mock.calls.some((c) => c[0] === 'git' && c[1]?.[0] === 'remote')).toBe(false);
    const ghMerge = callsTo('gh').find((c) => c[1]?.[1] === 'merge');
    expect(ghMerge).toBeTruthy();
    expect(ghMerge![1]).toEqual(expect.arrayContaining(['pr', 'merge', 'feat', '--squash']));
  });
});
