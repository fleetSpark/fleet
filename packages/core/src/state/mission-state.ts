import type { MissionStatus } from '../protocol/types.js';

export type StateEvent =
  | 'dependencies_met'
  | 'assign'
  | 'start'
  | 'complete'
  | 'block'
  | 'stall'
  | 'unblock'
  | 'unstall'
  | 'fail'
  | 'queue_merge'
  | 'merge';

const TRANSITIONS: Record<string, Record<string, MissionStatus>> = {
  pending: { dependencies_met: 'ready' },
  ready: { assign: 'assigned' },
  assigned: { start: 'in-progress' },
  'in-progress': {
    complete: 'completed',
    block: 'blocked',
    stall: 'stalled',
    fail: 'failed',
  },
  blocked: { unblock: 'in-progress', fail: 'failed' },
  stalled: { unstall: 'in-progress', fail: 'failed' },
  completed: { queue_merge: 'merge-queued' },
  'merge-queued': { merge: 'merged' },
};

export function transition(current: MissionStatus, event: StateEvent): MissionStatus {
  const next = TRANSITIONS[current]?.[event];
  if (!next) {
    throw new Error(
      `Invalid transition: cannot apply '${event}' to mission in '${current}' state`
    );
  }
  return next;
}
