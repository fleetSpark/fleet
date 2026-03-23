import { describe, it, expect } from 'vitest';
import { parseConfig, DEFAULT_CONFIG, type FleetConfig } from '@fleet/core';

describe('parseConfig', () => {
  it('returns defaults for empty config', () => {
    const config = parseConfig({});
    expect(config.commander.poll_interval_minutes).toBe(5);
    expect(config.execution.strategy).toBe('mapreduce');
    expect(config.heartbeat.interval_seconds).toBe(60);
  });

  it('merges partial config with defaults', () => {
    const config = parseConfig({
      commander: { model: 'claude-sonnet-4-5' },
    });
    expect(config.commander.model).toBe('claude-sonnet-4-5');
    expect(config.commander.poll_interval_minutes).toBe(5);
  });

  it('validates strategy enum', () => {
    expect(() =>
      parseConfig({ execution: { strategy: 'invalid' } })
    ).toThrow();
  });

  it('validates numeric ranges', () => {
    expect(() =>
      parseConfig({ commander: { max_concurrent_ships: -1 } })
    ).toThrow();
  });

  it('parses full valid config', () => {
    const config = parseConfig({
      commander: {
        model: 'claude-opus-4-5',
        poll_interval_minutes: 10,
        max_concurrent_ships: 4,
      },
      execution: {
        strategy: 'sequential',
        stall_threshold_min: 20,
        unresponsive_threshold_min: 5,
      },
      heartbeat: {
        interval_seconds: 30,
        squash_on_complete: false,
      },
      merge: {
        ci_required: false,
        auto_rebase: false,
      },
      ships: [{ id: 'ship-a', adapter: 'claude' }],
    });
    expect(config.commander.max_concurrent_ships).toBe(4);
    expect(config.execution.strategy).toBe('sequential');
    expect(config.ships).toHaveLength(1);
  });

  // Negative-path tests
  it('rejects zero poll interval', () => {
    expect(() =>
      parseConfig({ commander: { poll_interval_minutes: 0 } })
    ).toThrow();
  });

  it('rejects zero heartbeat interval', () => {
    expect(() =>
      parseConfig({ heartbeat: { interval_seconds: 0 } })
    ).toThrow();
  });

  it('rejects invalid strategy value', () => {
    expect(() =>
      parseConfig({ execution: { strategy: 'spark' } })
    ).toThrow();
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.commander.model).toBe('claude-opus-4-5');
    expect(DEFAULT_CONFIG.execution.stall_threshold_min).toBe(30);
    expect(DEFAULT_CONFIG.execution.unresponsive_threshold_min).toBe(10);
    expect(DEFAULT_CONFIG.heartbeat.interval_seconds).toBe(60);
    expect(DEFAULT_CONFIG.merge.ci_required).toBe(true);
  });
});
