import type { FleetAdapter, MissionBrief, AgentSession } from '@fleet/core';

export interface A2AConfig {
  agentUrl: string;
}

interface A2ATaskResponse {
  id: string;
  status: { state: 'submitted' | 'working' | 'completed' | 'failed' | 'canceled' };
}

const tasks = new Map<string, { taskId: string; agentUrl: string }>();
let pidCounter = 900_000;

export function createA2AAdapter(config: A2AConfig): FleetAdapter {
  return {
    name: 'a2a',

    async start(mission: MissionBrief, context?: string): Promise<AgentSession> {
      const prompt = [
        context ? `Context:\n${context}\n\n` : '',
        `Mission: ${mission.brief}`,
        `Branch: ${mission.branch}`,
        `\n\nIMPORTANT: Commit and push your work regularly.`,
      ].join('');

      const response = await fetch(config.agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/send',
          id: mission.id,
          params: {
            id: mission.id,
            message: {
              role: 'user',
              parts: [{ type: 'text', text: prompt }],
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`A2A tasks/send failed: HTTP ${response.status}`);
      }

      const data = await response.json() as { result: A2ATaskResponse };
      if (!data.result?.id) {
        throw new Error('A2A tasks/send returned no task ID');
      }
      const pid = ++pidCounter;
      tasks.set(String(pid), { taskId: data.result.id, agentUrl: config.agentUrl });

      return {
        pid,
        missionId: mission.id,
        adapter: 'a2a',
        startedAt: new Date(),
      };
    },

    async isAlive(session: AgentSession): Promise<boolean> {
      const task = tasks.get(String(session.pid));
      if (!task) return false;
      try {
        const response = await fetch(task.agentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tasks/get',
            id: session.missionId,
            params: { id: task.taskId },
          }),
        });
        const data = await response.json() as { result: A2ATaskResponse };
        return ['submitted', 'working'].includes(data.result.status.state);
      } catch {
        return false;
      }
    },

    async send(session: AgentSession, message: string): Promise<void> {
      const task = tasks.get(String(session.pid));
      if (!task) return;
      await fetch(task.agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/send',
          id: session.missionId,
          params: {
            id: task.taskId,
            message: { role: 'user', parts: [{ type: 'text', text: message }] },
          },
        }),
      });
    },

    async stop(session: AgentSession): Promise<void> {
      const task = tasks.get(String(session.pid));
      if (!task) return;
      try {
        await fetch(task.agentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tasks/cancel',
            id: session.missionId,
            params: { id: task.taskId },
          }),
        });
      } catch {
        // Best effort
      }
      tasks.delete(String(session.pid));
    },
  };
}
