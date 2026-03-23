import { describe, it, expect } from 'vitest';
import { transition, type StateEvent } from '@fleet/core';

describe('ship completion state transition', () => {
  it('transition from in-progress with complete event yields completed', () => {
    const result = transition('in-progress', 'complete');
    expect(result).toBe('completed');
  });

  it('completed state can transition to merge-queued', () => {
    const result = transition('completed', 'queue_merge');
    expect(result).toBe('merge-queued');
  });

  it('merge-queued can transition to merged', () => {
    const result = transition('merge-queued', 'merge');
    expect(result).toBe('merged');
  });

  it('full completion path: in-progress -> completed -> merge-queued -> merged', () => {
    let state: string = 'in-progress';
    const events: StateEvent[] = ['complete', 'queue_merge', 'merge'];

    for (const event of events) {
      state = transition(state as any, event);
    }

    expect(state).toBe('merged');
  });

  it('cannot skip directly from in-progress to merged', () => {
    expect(() => transition('in-progress', 'merge')).toThrow();
  });

  it('cannot skip directly from in-progress to merge-queued', () => {
    expect(() => transition('in-progress', 'queue_merge')).toThrow();
  });
});
