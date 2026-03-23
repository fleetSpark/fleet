import { describe, it, expect } from 'vitest';
import { parseFleetManifest, writeFleetManifest } from '@fleetspark/core';
import type { FleetManifest } from '@fleetspark/core';

const SAMPLE_FLEET_MD = `# Fleet manifest
Updated: 2026-03-22T14:30:00.000Z

## Commander
host: macbook-prabu  |  last_checkin: 2026-03-22T14:29:00.000Z  |  status: active
timeout_minutes: 15

## Active missions
| ID | Branch | Ship | Agent | Status | Depends | Blocker |
|----|--------|------|-------|--------|---------|---------|
| M1 | feature/oauth | ship-a | claude-code | in-progress | none | none |
| M2 | feature/ratelimiter | ship-b | codex | in-progress | none | none |
| M3 | feature/docs | ship-c | aider | blocked | M1 | M1 open |

## Merge queue
- M2 feature/ratelimiter — CI green, awaiting human approval

## Completed
- M0 feature/setup merged 2026-03-21T00:00:00.000Z
`;

describe('parseFleetManifest', () => {
  it('parses commander info', () => {
    const manifest = parseFleetManifest(SAMPLE_FLEET_MD);
    expect(manifest.commander.host).toBe('macbook-prabu');
    expect(manifest.commander.status).toBe('active');
    expect(manifest.commander.timeoutMinutes).toBe(15);
  });

  it('parses missions table', () => {
    const manifest = parseFleetManifest(SAMPLE_FLEET_MD);
    expect(manifest.missions).toHaveLength(3);
    expect(manifest.missions[0]).toMatchObject({
      id: 'M1',
      branch: 'feature/oauth',
      ship: 'ship-a',
      agent: 'claude-code',
      status: 'in-progress',
    });
    expect(manifest.missions[2].depends).toEqual(['M1']);
    expect(manifest.missions[2].blocker).toBe('M1 open');
  });

  it('parses "none" depends as empty array', () => {
    const manifest = parseFleetManifest(SAMPLE_FLEET_MD);
    expect(manifest.missions[0].depends).toEqual([]);
  });

  it('parses merge queue', () => {
    const manifest = parseFleetManifest(SAMPLE_FLEET_MD);
    expect(manifest.mergeQueue).toHaveLength(1);
    expect(manifest.mergeQueue[0].missionId).toBe('M2');
  });

  it('parses completed entries', () => {
    const manifest = parseFleetManifest(SAMPLE_FLEET_MD);
    expect(manifest.completed).toHaveLength(1);
    expect(manifest.completed[0].missionId).toBe('M0');
  });

  it('handles empty missions table', () => {
    const md = `# Fleet manifest
Updated: 2026-03-22T14:30:00.000Z

## Commander
host: test  |  last_checkin: 2026-03-22T14:30:00.000Z  |  status: active
timeout_minutes: 15

## Active missions
| ID | Branch | Ship | Agent | Status | Depends | Blocker |
|----|--------|------|-------|--------|---------|---------|

## Merge queue

## Completed
`;
    const manifest = parseFleetManifest(md);
    expect(manifest.missions).toHaveLength(0);
    expect(manifest.mergeQueue).toHaveLength(0);
    expect(manifest.completed).toHaveLength(0);
  });

  // Negative-path tests
  it('throws on missing Updated timestamp', () => {
    const md = `# Fleet manifest

## Commander
host: test  |  last_checkin: 2026-03-22T14:30:00.000Z  |  status: active
timeout_minutes: 15

## Active missions
| ID | Branch | Ship | Agent | Status | Depends | Blocker |
|----|--------|------|-------|--------|---------|---------|

## Merge queue

## Completed
`;
    expect(() => parseFleetManifest(md)).toThrow('Missing Updated timestamp');
  });

  it('throws on missing Commander section', () => {
    const md = `# Fleet manifest
Updated: 2026-03-22T14:30:00.000Z

## Commander

## Active missions
| ID | Branch | Ship | Agent | Status | Depends | Blocker |
|----|--------|------|-------|--------|---------|---------|

## Merge queue

## Completed
`;
    expect(() => parseFleetManifest(md)).toThrow('Invalid Commander section');
  });

  it('throws on malformed mission row (too few columns)', () => {
    const md = `# Fleet manifest
Updated: 2026-03-22T14:30:00.000Z

## Commander
host: test  |  last_checkin: 2026-03-22T14:30:00.000Z  |  status: active
timeout_minutes: 15

## Active missions
| ID | Branch | Ship | Agent | Status | Depends | Blocker |
|----|--------|------|-------|--------|---------|---------|
| M1 | feature/test |

## Merge queue

## Completed
`;
    expect(() => parseFleetManifest(md)).toThrow('Invalid mission row');
  });
});

describe('writeFleetManifest', () => {
  it('round-trips: parse → write → parse produces identical object', () => {
    const parsed = parseFleetManifest(SAMPLE_FLEET_MD);
    const written = writeFleetManifest(parsed);
    const reparsed = parseFleetManifest(written);
    expect(reparsed).toEqual(parsed);
  });
});
