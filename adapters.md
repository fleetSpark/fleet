# Writing a Fleet Adapter

An adapter is a thin wrapper that translates between Fleet's mission brief format and a specific coding agent's CLI or API. Writing one takes about 30 lines of TypeScript.

> **Status:** Interface is stable. Claude Code adapter shipping in v0.1. Codex (v0.5), Aider (v1.0), OpenCode (v1.1) planned.

---

## The adapter interface

```typescript
// packages/core/src/types.ts

export interface FleetAdapter {
  name: string;
  
  // Start the agent with a mission brief
  start(mission: MissionBrief, context: FleetContext): Promise<AgentSession>;
  
  // Check if the agent is still running
  isAlive(session: AgentSession): Promise<boolean>;
  
  // Send a message to a running agent (for unblocking)
  send(session: AgentSession, message: string): Promise<void>;
  
  // Stop the agent gracefully
  stop(session: AgentSession): Promise<void>;
}

export interface MissionBrief {
  mission_id: string;
  branch: string;
  description: string;
  context_file?: string;    // path to FLEET_CONTEXT.md if generated
  depends_on: string[];
}

export interface AgentSession {
  pid?: number;
  started_at: string;
  worktree_path: string;
}
```

---

## Example: minimal Claude Code adapter

```typescript
// packages/adapters/claude/src/index.ts
import { spawn } from 'child_process';
import { FleetAdapter, MissionBrief, AgentSession } from '@fleet/core';

export const claudeAdapter: FleetAdapter = {
  name: 'claude-code',

  async start(mission: MissionBrief, context): Promise<AgentSession> {
    const worktreePath = context.worktreePath;
    
    // Build the initial prompt from the mission brief
    const prompt = buildPrompt(mission, context.fleetContextPath);
    
    // Launch Claude Code in the worktree directory
    const proc = spawn('claude', ['--dangerously-skip-permissions'], {
      cwd: worktreePath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    // Send the mission brief as the opening message
    proc.stdin.write(prompt + '\n');
    
    return {
      pid: proc.pid,
      started_at: new Date().toISOString(),
      worktree_path: worktreePath,
    };
  },

  async isAlive(session): Promise<boolean> {
    if (!session.pid) return false;
    try {
      process.kill(session.pid, 0);
      return true;
    } catch {
      return false;
    }
  },

  async send(session, message): Promise<void> {
    // Implementation: write to the agent's stdin
  },

  async stop(session): Promise<void> {
    if (session.pid) process.kill(session.pid, 'SIGTERM');
  },
};

function buildPrompt(mission: MissionBrief, contextPath?: string): string {
  let prompt = `# Fleet Mission ${mission.mission_id}\n\n${mission.description}\n\n`;
  
  if (contextPath) {
    prompt += `Read ${contextPath} first for codebase context.\n\n`;
  }
  
  prompt += `When complete, update MISSION.md with status: completed.\n`;
  prompt += `Push MISSION.md every 60 seconds as a heartbeat even if no progress.\n`;
  
  return prompt;
}
```

---

## Submitting an adapter

1. Fork `github.com/fleetspark/fleet`
2. Create `packages/adapters/<your-agent>/`
3. Implement the `FleetAdapter` interface
4. Add a test: does `fleet ship --join` work with your adapter on a real repo?
5. Open a PR — include the agent name, install instructions, and a short demo

Adapters for **Gemini CLI**, **OpenCode**, **Cursor CLI**, and **Amp** are all wanted.
