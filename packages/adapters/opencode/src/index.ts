import { spawn } from 'node:child_process';
import type { FleetAdapter, MissionBrief, AgentSession } from '@fleet/core';

const sessions = new Map<number, ReturnType<typeof spawn>>();

export const opencodeAdapter: FleetAdapter = {
  name: 'opencode',

  async start(mission: MissionBrief, context?: string): Promise<AgentSession> {
    const prompt = [
      context ? `Context:\n${context}\n\n` : '',
      `Mission: ${mission.brief}`,
      `Branch: ${mission.branch}`,
      '\n\nCommit and push your work regularly. When done, update MISSION.md status to completed.',
    ].join('');

    const child = spawn('opencode', ['--non-interactive', '--message', prompt], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!child.pid) throw new Error('Failed to start opencode process');
    sessions.set(child.pid, child);

    return { pid: child.pid, missionId: mission.id, adapter: 'opencode', startedAt: new Date() };
  },

  async isAlive(session: AgentSession): Promise<boolean> {
    try { process.kill(session.pid, 0); return true; } catch { return false; }
  },

  async send(session: AgentSession, message: string): Promise<void> {
    const child = sessions.get(session.pid);
    if (child?.stdin?.writable) child.stdin.write(message + '\n');
  },

  async stop(session: AgentSession): Promise<void> {
    const child = sessions.get(session.pid);
    if (!child) return;
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 10_000);
      child.on('exit', () => { clearTimeout(timeout); resolve(); });
    });
    sessions.delete(session.pid);
  },
};
