import { spawn, type ChildProcess } from 'node:child_process';
import type { FleetAdapter, MissionBrief, AgentSession, AgentExitInfo } from '@fleetspark/core';

const processes = new Map<number, ChildProcess>();

/**
 * Per-PID exit info captured on the 'exit' event. Lets ship.ts differentiate
 * clean exit (cleanExit: true) from signal-kill / crash (cleanExit: false)
 * even after the process is gone.
 */
const exitInfo = new Map<number, AgentExitInfo>();

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

    // V1.1.8: switch from piped-stdin REPL mode to `-p` (print/non-interactive)
    // batch mode. The previous approach (`spawn('claude', [...], {stdio: pipe})`
    // + `proc.stdin.write(prompt)`) caused claude-code to silently hang for
    // hours: without a TTY the CLI couldn't read piped stdin in its expected
    // shape, and instead entered a wait-for-input limbo that burned ~0.3s of
    // CPU per minute and produced zero work output. Fleet's ship-side heartbeat
    // kept ticking, masking the hang.
    //
    // `-p "<prompt>"` makes claude-code accept the entire prompt as a single
    // argv entry and run to completion non-interactively, exiting when done.
    // stdin is closed (`stdio[0] = 'ignore'`) so the CLI doesn't wait for it.
    const proc = spawn(
      'claude',
      ['-p', prompt, '--dangerously-skip-permissions'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    if (!proc.pid) {
      throw new Error('Failed to spawn claude process');
    }

    processes.set(proc.pid, proc);

    // Capture exit code + signal exactly once. Cleared from `processes` so
    // isAlive() returns false; preserved in `exitInfo` so ship.ts can later
    // distinguish clean exit (cleanExit: true) from kill/crash.
    const pid = proc.pid;
    proc.on('exit', (code, signal) => {
      exitInfo.set(pid, {
        cleanExit: signal === null && code === 0,
        exitCode: code ?? undefined,
        signal: signal ?? undefined,
      });
      processes.delete(pid);
    });

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

  async getExitInfo(session: AgentSession): Promise<AgentExitInfo | undefined> {
    return exitInfo.get(session.pid);
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
