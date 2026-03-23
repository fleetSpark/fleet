import { describe, it, expect } from 'vitest';
import { parseMissionLog } from '@fleetspark/core';

describe('heartbeat default to epoch when missing', () => {
  it('returns epoch for lastPush when no heartbeat section exists', () => {
    const markdown = [
      '# Mission log — feat/test',
      'Ship: ship1  |  Agent: claude  |  Status: in-progress',
      '',
      '## Mission brief',
      'Do the thing.',
      '',
      '## Steps',
      '- [ ] Step one',
      '',
      '## Blockers',
      'none',
      '',
    ].join('\n');

    const log = parseMissionLog(markdown);
    // lastPush should be epoch (1970-01-01), NOT current time
    const epoch = new Date(0);
    expect(log.heartbeat.lastPush.getTime()).toBe(epoch.getTime());
  });

  it('returns epoch for lastPush when heartbeat section exists but has no last_push line', () => {
    const markdown = [
      '# Mission log — feat/test',
      'Ship: ship1  |  Agent: claude  |  Status: in-progress',
      '',
      '## Mission brief',
      'Do the thing.',
      '',
      '## Steps',
      '- [ ] Step one',
      '',
      '## Blockers',
      'none',
      '',
      '## Heartbeat',
      'push_interval_seconds: 120',
      '',
    ].join('\n');

    const log = parseMissionLog(markdown);
    const epoch = new Date(0);
    expect(log.heartbeat.lastPush.getTime()).toBe(epoch.getTime());
    expect(log.heartbeat.pushInterval).toBe(120);
  });

  it('parses actual last_push when present', () => {
    const pushDate = '2025-06-15T12:00:00.000Z';
    const markdown = [
      '# Mission log — feat/test',
      'Ship: ship1  |  Agent: claude  |  Status: in-progress',
      '',
      '## Mission brief',
      'Do the thing.',
      '',
      '## Steps',
      '- [x] Step one',
      '',
      '## Blockers',
      'none',
      '',
      '## Heartbeat',
      `last_push: ${pushDate}`,
      'push_interval_seconds: 60',
      '',
    ].join('\n');

    const log = parseMissionLog(markdown);
    expect(log.heartbeat.lastPush.toISOString()).toBe(pushDate);
  });

  it('lastPush is NOT close to current time when missing', () => {
    const markdown = [
      '# Mission log — feat/test',
      'Ship: ship1  |  Agent: claude  |  Status: in-progress',
      '',
      '## Mission brief',
      'Do the thing.',
      '',
      '## Steps',
      '- [ ] Step one',
      '',
      '## Blockers',
      'none',
      '',
    ].join('\n');

    const log = parseMissionLog(markdown);
    const now = Date.now();
    // If the bug existed (using new Date() instead of new Date(0)),
    // lastPush would be within a few seconds of now.
    // With the fix, it should be ~55 years in the past.
    const diffMs = now - log.heartbeat.lastPush.getTime();
    expect(diffMs).toBeGreaterThan(365 * 24 * 60 * 60 * 1000); // more than 1 year ago
  });
});
