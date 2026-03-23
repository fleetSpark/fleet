---
title: Adapters
description: Built-in adapters and how to write your own Fleet adapter.
---

An adapter is a thin wrapper that translates between Fleet's mission brief format and a specific coding agent's CLI or API. Writing one takes about 30 lines of TypeScript.

---

## Built-in adapters

Fleet ships with eight adapters out of the box:

| Adapter | npm package | Agent | How it works |
|---------|------------|-------|-------------|
| `claude-code` | `@fleet/adapter-claude` | [Claude Code](https://claude.ai) | Spawns `claude --dangerously-skip-permissions` |
| `codex` | `@fleet/adapter-codex` | [Codex CLI](https://github.com/openai/codex) | Spawns `codex --full-auto --quiet` |
| `aider` | `@fleet/adapter-aider` | [Aider](https://aider.chat) | Spawns `aider --yes-always --no-git --message` |
| `opencode` | `@fleet/adapter-opencode` | [OpenCode](https://opencode.ai) | Spawns `opencode --non-interactive --message` |
| `gemini` | `@fleet/adapter-gemini` | [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Spawns `gemini --noinput --prompt` |
| `cursor` | `@fleet/adapter-cursor` | [Cursor](https://cursor.com) | Spawns `cursor --cli --prompt` |
| `amp` | `@fleet/adapter-amp` | [Amp](https://ampcode.com) | Spawns `amp --non-interactive --message` |
| `a2a` | `@fleet/adapter-a2a` | Any A2A agent | JSON-RPC over HTTP (Google A2A protocol) |

### Using an adapter

Set the adapter name in your `.fleet/config.yml`:

```yaml
ships:
  - id: ship-a
    adapter: claude-code
  - id: ship-b
    adapter: codex
  - id: ship-c
    adapter: aider
```

The adapter registry resolves names to implementations automatically. Custom adapters installed as npm packages are discovered via `require.resolve`.

---

## The adapter interface

```typescript
export interface FleetAdapter {
  name: string;

  // Start the agent with a mission brief
  start(mission: MissionBrief, context?: string): Promise<AgentSession>;

  // Check if the agent is still running
  isAlive(session: AgentSession): Promise<boolean>;

  // Send a message to a running agent (for unblocking)
  send(session: AgentSession, message: string): Promise<void>;

  // Stop the agent gracefully
  stop(session: AgentSession): Promise<void>;
}

export interface MissionBrief {
  id: string;
  branch: string;
  brief: string;
  agent: string;
  depends: string[];
}

export interface AgentSession {
  pid: number;
  missionId: string;
  adapter: string;
  startedAt: Date;
}
```

---

## Writing a custom adapter

### CLI-based agents

For agents with a CLI, spawn a child process:

```typescript
import { spawn, ChildProcess } from 'child_process';
import type { FleetAdapter, MissionBrief, AgentSession } from '@fleet/core';

const processes = new Map<number, ChildProcess>();

export const myAdapter: FleetAdapter = {
  name: 'my-agent',

  async start(mission: MissionBrief, context?: string): Promise<AgentSession> {
    const prompt = [
      context ? `Context:\n${context}\n\n` : '',
      `Mission: ${mission.brief}`,
      `Branch: ${mission.branch}`,
      '\n\nCommit and push your work regularly.',
    ].join('');

    const proc = spawn('my-agent', ['--auto', '--message', prompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (proc.pid) processes.set(proc.pid, proc);

    return {
      pid: proc.pid!,
      missionId: mission.id,
      adapter: 'my-agent',
      startedAt: new Date(),
    };
  },

  async isAlive(session: AgentSession): Promise<boolean> {
    try { process.kill(session.pid, 0); return true; }
    catch { return false; }
  },

  async send(session: AgentSession, message: string): Promise<void> {
    const proc = processes.get(session.pid);
    proc?.stdin?.write(message + '\n');
  },

  async stop(session: AgentSession): Promise<void> {
    try { process.kill(session.pid, 'SIGTERM'); }
    catch { /* already dead */ }
    processes.delete(session.pid);
  },
};
```

### HTTP/API-based agents (A2A)

For agents with an HTTP API, use the A2A protocol pattern:

```typescript
import type { FleetAdapter, MissionBrief, AgentSession } from '@fleet/core';

export function createMyAPIAdapter(config: { apiUrl: string }): FleetAdapter {
  const tasks = new Map<string, string>();

  return {
    name: 'my-api-agent',

    async start(mission, context) {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: mission.brief, context }),
      });
      const data = await response.json();
      tasks.set(mission.id, data.taskId);
      return { pid: 0, missionId: mission.id, adapter: 'my-api-agent', startedAt: new Date() };
    },

    async isAlive(session) {
      const taskId = tasks.get(session.missionId);
      if (!taskId) return false;
      const res = await fetch(`${config.apiUrl}/${taskId}`);
      const data = await res.json();
      return data.status === 'running';
    },

    async send() { /* Not supported for API agents */ },

    async stop(session) {
      const taskId = tasks.get(session.missionId);
      if (taskId) await fetch(`${config.apiUrl}/${taskId}`, { method: 'DELETE' });
      tasks.delete(session.missionId);
    },
  };
}
```

---

## Adapter resolution

Fleet resolves adapters in this order:

1. **Built-in name** — `claude-code`, `codex`, `aider`, `opencode`, `gemini`, `cursor`, `amp`, `a2a`
2. **npm package** — `require.resolve(name)` for custom adapters installed as dependencies
3. **Factory function** — A2A adapters use `createA2AAdapter(config)` with a URL

---

## Submitting an adapter

1. Fork `github.com/fleetspark/fleet`
2. Create `packages/adapters/<your-agent>/`
3. Implement the `FleetAdapter` interface
4. Add unit tests in `tests/unit/adapters/`
5. Open a PR — include the agent name, install instructions, and a short demo
