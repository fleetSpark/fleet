import { describe, it, expect } from 'vitest';
import { formatMissionLog } from '../../../packages/cli/src/commands/logs.js';

describe('formatMissionLog', () => {
  it('formats mission log with steps and heartbeat', () => {
    const output = formatMissionLog({
      missionId: 'M1', branch: 'feature/auth', ship: 'ship-a',
      agent: 'claude-code', status: 'in-progress',
      steps: [
        { text: 'Read existing auth middleware', done: true },
        { text: 'Scaffold OAuth route', done: true },
        { text: 'Implement callback handler', done: false },
      ],
      blockers: [],
      lastHeartbeat: new Date(Date.now() - 12_000),
    });
    expect(output).toContain('Mission M1 — feature/auth');
    expect(output).toContain('Ship: ship-a');
    expect(output).toContain('Status: in-progress');
    expect(output).toContain('[x] Read existing auth middleware');
    expect(output).toContain('[ ] Implement callback handler');
    expect(output).toContain('Blockers: none');
  });

  it('shows blockers when present', () => {
    const output = formatMissionLog({
      missionId: 'M1', branch: 'feature/auth', ship: 'ship-a',
      agent: 'claude-code', status: 'blocked', steps: [],
      blockers: ['Waiting for API key'],
      lastHeartbeat: new Date(),
    });
    expect(output).toContain('Waiting for API key');
  });

  it('handles empty steps', () => {
    const output = formatMissionLog({
      missionId: 'M1', branch: 'feature/test', ship: 'ship-b',
      agent: 'claude-code', status: 'assigned', steps: [],
      blockers: [], lastHeartbeat: new Date(),
    });
    expect(output).toContain('Steps:\n  (none)');
  });
});
