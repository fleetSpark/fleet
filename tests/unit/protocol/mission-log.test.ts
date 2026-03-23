import { describe, it, expect } from 'vitest';
import { parseMissionLog, writeMissionLog } from '@fleet/core';

const SAMPLE_MISSION_MD = `# Mission log — feature/oauth
Ship: ship-a  |  Agent: claude-code  |  Status: in-progress

## Mission brief
Implement GitHub OAuth flow. Callback at /auth/github/callback.
Use existing session middleware. Tests required.

## Steps
- [x] Read existing auth middleware
- [x] Scaffold OAuth route
- [ ] Implement callback handler
- [ ] Write integration tests

## Blockers
none

## Heartbeat
last_push: 2026-03-22T14:28:00.000Z
push_interval_seconds: 60
`;

describe('parseMissionLog', () => {
  it('parses header fields', () => {
    const log = parseMissionLog(SAMPLE_MISSION_MD);
    expect(log.branch).toBe('feature/oauth');
    expect(log.ship).toBe('ship-a');
    expect(log.agent).toBe('claude-code');
    expect(log.status).toBe('in-progress');
  });

  it('parses mission brief', () => {
    const log = parseMissionLog(SAMPLE_MISSION_MD);
    expect(log.brief).toContain('Implement GitHub OAuth flow');
    expect(log.brief).toContain('Tests required');
  });

  it('parses steps with checkbox state', () => {
    const log = parseMissionLog(SAMPLE_MISSION_MD);
    expect(log.steps).toHaveLength(4);
    expect(log.steps[0]).toEqual({ text: 'Read existing auth middleware', done: true });
    expect(log.steps[2]).toEqual({ text: 'Implement callback handler', done: false });
  });

  it('parses blockers', () => {
    const log = parseMissionLog(SAMPLE_MISSION_MD);
    expect(log.blockers).toEqual([]);
  });

  it('parses heartbeat', () => {
    const log = parseMissionLog(SAMPLE_MISSION_MD);
    expect(log.heartbeat.pushInterval).toBe(60);
  });

  it('parses blockers when present', () => {
    const md = SAMPLE_MISSION_MD.replace(
      '## Blockers\nnone',
      '## Blockers\nWaiting on M1 to complete OAuth setup'
    );
    const log = parseMissionLog(md);
    expect(log.blockers).toEqual(['Waiting on M1 to complete OAuth setup']);
  });

  // Negative-path tests
  it('handles missing branch in header', () => {
    const md = `# Mission log
Ship: ship-a  |  Agent: claude-code  |  Status: in-progress

## Mission brief
Test

## Steps

## Blockers
none

## Heartbeat
last_push: 2026-03-22T14:28:00.000Z
push_interval_seconds: 60
`;
    const log = parseMissionLog(md);
    expect(log.branch).toBe('');
  });

  it('handles missing heartbeat section gracefully', () => {
    const md = `# Mission log — feature/test
Ship: ship-a  |  Agent: claude-code  |  Status: in-progress

## Mission brief
Test

## Steps
- [ ] Step 1

## Blockers
none
`;
    const log = parseMissionLog(md);
    // Defaults when heartbeat section is missing
    expect(log.heartbeat.pushInterval).toBe(60);
  });

  it('handles empty steps section', () => {
    const md = `# Mission log — feature/test
Ship: ship-a  |  Agent: claude-code  |  Status: pending

## Mission brief
Test

## Steps

## Blockers
none

## Heartbeat
last_push: 2026-03-22T14:28:00.000Z
push_interval_seconds: 60
`;
    const log = parseMissionLog(md);
    expect(log.steps).toHaveLength(0);
  });
});

describe('writeMissionLog', () => {
  it('round-trips: parse → write → parse produces identical object', () => {
    const parsed = parseMissionLog(SAMPLE_MISSION_MD);
    const written = writeMissionLog(parsed);
    const reparsed = parseMissionLog(written);
    expect(reparsed).toEqual(parsed);
  });
});
