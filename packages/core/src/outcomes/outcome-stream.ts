import type { FleetManifest, Mission, MissionStatus } from '../protocol/types.js';

/**
 * Coarse outcome classification for a mission, derived from its current
 * lifecycle state. The merge commander already drives every mission to one of
 * these terminal-or-transient states; `fleet outcomes` exposes that as a stream
 * a planner can consume to detect failed/stalled batches.
 */
export type OutcomeKind =
  | 'merged'       // terminal success
  | 'failed'       // terminal failure
  | 'stalled'      // ship went dark / shadow-dispatched — needs attention
  | 'blocked'      // waiting on a blocker (conflict, dependency, manual gate)
  | 'in-progress'  // actively executing
  | 'pending';     // queued, not yet started

export interface MissionOutcome {
  missionId: string;
  branch: string;
  ship: string | null;
  agent: string;
  status: MissionStatus;
  kind: OutcomeKind;
  /** True for merged/failed — the mission has reached a terminal state. */
  terminal: boolean;
  blocker: string;
  /** ISO timestamp of the relevant event (merge date for merged missions). */
  at: string | null;
}

export interface OutcomeBatchSummary {
  total: number;
  merged: number;
  failed: number;
  stalled: number;
  blocked: number;
  inProgress: number;
  pending: number;
  /**
   * A "clean run" has no failed or stalled missions. Planners gate the ramp
   * toward auto-assign behind a streak of clean runs.
   */
  cleanRun: boolean;
  /** All missions reached a terminal state (merged or failed). */
  complete: boolean;
}

const KIND_BY_STATUS: Record<MissionStatus, OutcomeKind> = {
  'pending':      'pending',
  'ready':        'pending',
  'assigned':     'in-progress',
  'in-progress':  'in-progress',
  'merge-queued': 'in-progress',
  'completed':    'in-progress',
  'merged':       'merged',
  'failed':       'failed',
  'stalled':      'stalled',
  'blocked':      'blocked',
};

function classifyMission(mission: Mission, manifest: FleetManifest): MissionOutcome {
  const kind = KIND_BY_STATUS[mission.status];
  const terminal = kind === 'merged' || kind === 'failed';

  let at: string | null = null;
  if (mission.status === 'merged') {
    const entry = manifest.completed.find((c) => c.missionId === mission.id);
    if (entry) at = new Date(entry.mergedDate).toISOString();
  }

  return {
    missionId: mission.id,
    branch: mission.branch,
    ship: mission.ship,
    agent: mission.agent,
    status: mission.status,
    kind,
    terminal,
    blocker: mission.blocker && mission.blocker !== 'none' ? mission.blocker : '',
    at,
  };
}

/** Classify every mission in the manifest into an outcome event. */
export function classifyOutcomes(manifest: FleetManifest): MissionOutcome[] {
  return manifest.missions.map((m) => classifyMission(m, manifest));
}

export function summarizeOutcomes(outcomes: MissionOutcome[]): OutcomeBatchSummary {
  const count = (k: OutcomeKind) => outcomes.filter((o) => o.kind === k).length;
  const merged = count('merged');
  const failed = count('failed');
  const stalled = count('stalled');
  const total = outcomes.length;

  return {
    total,
    merged,
    failed,
    stalled,
    blocked: count('blocked'),
    inProgress: count('in-progress'),
    pending: count('pending'),
    cleanRun: failed === 0 && stalled === 0,
    complete: total > 0 && outcomes.every((o) => o.terminal),
  };
}

export function generateOutcomesJson(manifest: FleetManifest): {
  generatedAt: string;
  summary: OutcomeBatchSummary;
  outcomes: MissionOutcome[];
} {
  const outcomes = classifyOutcomes(manifest);
  return {
    generatedAt: new Date().toISOString(),
    summary: summarizeOutcomes(outcomes),
    outcomes,
  };
}

const KIND_EMOJI: Record<OutcomeKind, string> = {
  'merged':      '🟢',
  'failed':      '❌',
  'stalled':     '⚠️',
  'blocked':     '🚫',
  'in-progress': '🔄',
  'pending':     '⏳',
};

/** Render the outcome stream as a compact, human-readable text block. */
export function renderOutcomes(manifest: FleetManifest): string {
  const outcomes = classifyOutcomes(manifest);
  const summary = summarizeOutcomes(outcomes);
  const lines: string[] = [];

  lines.push('Mission Outcomes');
  lines.push(
    `  ${summary.merged} merged · ${summary.failed} failed · ${summary.stalled} stalled · ` +
      `${summary.blocked} blocked · ${summary.inProgress} in-progress · ${summary.pending} pending`
  );
  lines.push(
    `  run: ${summary.complete ? 'complete' : 'active'}, ${summary.cleanRun ? 'clean' : 'needs attention'}`
  );
  lines.push('');

  if (outcomes.length === 0) {
    lines.push('  (no missions)');
    return lines.join('\n');
  }

  for (const o of outcomes) {
    const emoji = KIND_EMOJI[o.kind];
    const ship = o.ship ?? '—';
    const tail = o.blocker ? `  [${o.blocker}]` : o.at ? `  @ ${o.at}` : '';
    lines.push(`  ${emoji} ${o.missionId}  ${o.kind.padEnd(11)} ${o.branch} (${ship})${tail}`);
  }

  return lines.join('\n');
}
