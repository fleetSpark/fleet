import { describe, it, expect } from 'vitest';
import { parseFleetManifest } from '@fleetspark/core';

function makeManifest(status: string): string {
  return [
    '# Fleet manifest',
    `Updated: ${new Date().toISOString()}`,
    '',
    '## Commander',
    `host: laptop  |  last_checkin: ${new Date().toISOString()}  |  status: active`,
    'timeout_minutes: 15',
    '',
    '## Active missions',
    '| ID | Branch | Ship | Agent | Status | Depends | Blocker |',
    '|----|--------|------|-------|--------|---------|---------|',
    `| M1 | feat/x | ship1 | claude | ${status} | none | none |`,
    '',
    '## Merge queue',
    '',
    '## Completed',
    '',
  ].join('\n');
}

describe('mission status validation in parseFleetManifest', () => {
  const validStatuses = [
    'pending',
    'ready',
    'assigned',
    'in-progress',
    'completed',
    'blocked',
    'stalled',
    'failed',
    'merge-queued',
    'merged',
  ];

  for (const status of validStatuses) {
    it(`accepts valid status "${status}"`, () => {
      const manifest = parseFleetManifest(makeManifest(status));
      expect(manifest.missions[0].status).toBe(status);
    });
  }

  const invalidStatuses = [
    'in progress',   // missing hyphen
    'In-Progress',   // wrong case
    'done',          // not a real status
    'active',        // commander status, not mission status
    'merge_queued',  // underscore instead of hyphen
    // Note: empty string causes a row-parse error before status validation,
    // so we don't test it here — it's caught by a different check.
  ];

  for (const status of invalidStatuses) {
    it(`rejects invalid status "${status}"`, () => {
      expect(() => parseFleetManifest(makeManifest(status))).toThrow();
    });
  }
});
