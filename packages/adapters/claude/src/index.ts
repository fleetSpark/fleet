import { spawn, type ChildProcess } from 'node:child_process';
import type { FleetAdapter, MissionBrief, AgentSession } from '@fleet/core';

const processes = new Map<number, ChildProcess>();

function buildPrompt(mission: MissionBrief, context?: string): string {
  let prompt = `# Fleet Mission ${mission.id}\n\n${mission.brief}\n\n`;

  if (context) {
    prompt += `## Codebase Context\n\n${context}\n\n`;
  }

  prompt += `When complete, update MISSION.md with status: completed.\n`;
  prompt += `Push MISSION.md every 60 seconds as a heartbeat even if no progress.\n`;

  return prompt;
}

export const claudeAdapter: FleetAdapter = {
  name: 'claude-code',

  async start(mission: MissionBrief, context?: string): Promise<AgentSession> {
    const prompt = buildPrompt(mission, context);

    const proc = spawn('claude', ['--dangerously-skip-permissions'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!proc.pid) {
      throw new Error('Failed to spawn claude process');
    }

    processes.set(proc.pid, proc);
    proc.stdin?.write(prompt + '\n');

    return {
      pid: proc.pid,
      missionId: mission.id,
      adapter: 'claude-code',
      startedAt: new Date(),
    };
  },

  async isAlive(session: AgentSession): Promise<boolean> {
    try {
      process.kill(session.pid, 0);
      return true;
    } catch {
      return false;
    }
  },

  async send(session: AgentSession, message: string): Promise<void> {
    const proc = processes.get(session.pid);
    if (proc?.stdin?.writable) {
      proc.stdin.write(message + '\n');
    }
  },

  async stop(session: AgentSession): Promise<void> {
    const proc = processes.get(session.pid);
    if (!proc) return;

    proc.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {}
        resolve();
      }, 10_000);

      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    processes.delete(session.pid);
  },
};
