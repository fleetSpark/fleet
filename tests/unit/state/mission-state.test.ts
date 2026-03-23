import { describe, it, expect } from 'vitest';
import { transition, type StateEvent } from '@fleet/core';

describe('mission state machine', () => {
  const validTransitions: Array<[string, StateEvent, string]> = [
    ['pending', 'dependencies_met', 'ready'],
    ['ready', 'assign', 'assigned'],
    ['assigned', 'start', 'in-progress'],
    ['in-progress', 'complete', 'completed'],
    ['in-progress', 'block', 'blocked'],
    ['in-progress', 'stall', 'stalled'],
    ['in-progress', 'fail', 'failed'],
    ['blocked', 'unblock', 'in-progress'],
    ['blocked', 'fail', 'failed'],
    ['stalled', 'unstall', 'in-progress'],
    ['stalled', 'fail', 'failed'],
    ['completed', 'queue_merge', 'merge-queued'],
    ['merge-queued', 'merge', 'merged'],
  ];

  for (const [from, event, to] of validTransitions) {
    it(`${from} + ${event} → ${to}`, () => {
      const result = transition(from as any, event);
      expect(result).toBe(to);
    });
  }

  const invalidTransitions: Array<[string, StateEvent]> = [
    ['pending', 'assign'],
    ['ready', 'complete'],
    ['assigned', 'complete'],
    ['completed', 'block'],
    ['merged', 'assign'],
    ['failed', 'complete'],
  ];

  for (const [from, event] of invalidTransitions) {
    it(`${from} + ${event} → error`, () => {
      expect(() => transition(from as any, event)).toThrow();
    });
  }
});
