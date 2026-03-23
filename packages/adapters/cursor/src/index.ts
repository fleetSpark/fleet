import { spawn } from 'node:child_process';
import type { FleetAdapter, MissionBrief, AgentSession } from '@fleetspark/core';

const sessions = new Map<number, ReturnType<typeof spawn>>();

function buildPrompt(mission: MissionBrief, context?: string): string {
  let prompt = `# Fleet Mission ${mission.id}\n\n${mission.brief}\n\n`;

  if (context) {
    prompt += `## Codebase Context\n\n${context}\n\n`;
  }

  prompt += `When complete, update MISSION.md with status: completed.\n`;
  prompt += `Push MISSION.md every 60 seconds as a heartbeat even if no progress.\n`;

  return prompt;
}

export const cursorAdapter: FleetAdapter = {
  name: 'cursor',

  async start(mission: MissionBrief, context?: string): Promise<AgentSession> {
    const prompt = buildPrompt(mission, context);

    const child = spawn('cursor', ['--cli', '--prompt', prompt], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!child.pid) throw new Error('Failed to start cursor process');
    sessions.set(child.pid, child);

    return { pid: child.pid, missionId: mission.id, adapter: 'cursor', startedAt: new Date() };
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
