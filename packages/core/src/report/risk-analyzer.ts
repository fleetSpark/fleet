import type { FleetManifest, Mission } from '../protocol/types.js';

export type RiskSeverity = 'high' | 'medium' | 'low';

export type RiskKind =
  | 'ci-failure'
  | 'stalled-mission'
  | 'aging-mission'
  | 'idle-ship-queue'
  | 'blocked-chain'
  | 'stale-batch';

export interface RiskItem {
  severity: RiskSeverity;
  kind: RiskKind;
  missionId?: string;
  message: string;
}

export interface RiskSignals {
  ciFailures: number;
  stalledMissions: number;
  agingMissions: number;
  blockedChains: number;
  idleShips: number;
  queuedMissions: number;
  staleBatches: number;
}

export interface RiskReport {
  generatedAt: string;
  /** 0 (healthy) … 100 (critical). Weighted sum of signal severities. */
  score: number;
  level: 'healthy' | 'watch' | 'at-risk' | 'critical';
  signals: RiskSignals;
  items: RiskItem[];
}

export interface RiskOptions {
  now?: Date;
  /** Missions older than this (since manifest.updated) count as aging. */
  agingThresholdMin?: number;
  /** Ships known to the fleet (e.g. from config) — used for idle detection. */
  knownShips?: string[];
  /** Count of planner batches awaiting approval beyond their freshness window. */
  staleBatches?: number;
}

const SEVERITY_WEIGHT: Record<RiskSeverity, number> = { high: 25, medium: 12, low: 5 };

function activeMissions(missions: Mission[]): Mission[] {
  return missions.filter(
    (m) => !['merged', 'failed'].includes(m.status)
  );
}

/**
 * Continuous health/risk view over a fleet manifest. Surfaces CI-failure
 * trends, stalled/aging missions, idle-ship-while-queue-nonempty, blocked
 * dependency chains, and stale unapproved batches. Backs both
 * `fleet report --live` and the web-dashboard risk panel.
 */
export function analyzeRisk(manifest: FleetManifest, opts: RiskOptions = {}): RiskReport {
  const now = opts.now ?? new Date();
  const agingThresholdMin = opts.agingThresholdMin ?? 60;
  const items: RiskItem[] = [];

  const missions = manifest.missions;

  // 1) CI-failure trends — from merge queue + blocker text.
  const ciFailedQueue = manifest.mergeQueue.filter(
    (e) => e.ciStatus === 'failed' || e.ciStatus === 'failure'
  );
  const ciFailedMissions = missions.filter((m) => /ci\s*fail/i.test(m.blocker));
  const ciFailures = new Set([
    ...ciFailedQueue.map((e) => e.missionId),
    ...ciFailedMissions.map((m) => m.id),
  ]).size;
  for (const id of new Set([
    ...ciFailedQueue.map((e) => e.missionId),
    ...ciFailedMissions.map((m) => m.id),
  ])) {
    items.push({
      severity: 'high',
      kind: 'ci-failure',
      missionId: id,
      message: `Mission ${id} has a failing CI check in the merge queue`,
    });
  }

  // 2) Stalled missions.
  const stalled = missions.filter((m) => m.status === 'stalled');
  for (const m of stalled) {
    items.push({
      severity: 'high',
      kind: 'stalled-mission',
      missionId: m.id,
      message: `Mission ${m.id} is stalled${m.ship ? ` on ship ${m.ship}` : ''}${m.blocker && m.blocker !== 'none' ? ` (${m.blocker})` : ''}`,
    });
  }

  // 3) Aging missions — in-flight longer than the threshold (proxy: manifest age).
  const manifestAgeMin = (now.getTime() - new Date(manifest.updated).getTime()) / 60_000;
  const inFlight = missions.filter((m) => m.status === 'in-progress' || m.status === 'assigned');
  let agingMissions = 0;
  if (manifestAgeMin >= agingThresholdMin) {
    agingMissions = inFlight.length;
    for (const m of inFlight) {
      items.push({
        severity: 'medium',
        kind: 'aging-mission',
        missionId: m.id,
        message: `Mission ${m.id} has been ${m.status} with no fleet update for ${Math.round(manifestAgeMin)}m`,
      });
    }
  }

  // 4) Idle ship while queue non-empty.
  const queuedMissions = missions.filter((m) => m.status === 'ready' || m.status === 'pending').length;
  const busyShips = new Set(
    activeMissions(missions)
      .filter((m) => m.ship && (m.status === 'in-progress' || m.status === 'assigned'))
      .map((m) => m.ship as string)
  );
  const knownShips = new Set(opts.knownShips ?? []);
  // Include ships seen anywhere in the manifest as "known" if no list provided.
  if (knownShips.size === 0) {
    for (const m of missions) if (m.ship) knownShips.add(m.ship);
  }
  const idleShips = [...knownShips].filter((s) => !busyShips.has(s));
  if (queuedMissions > 0 && idleShips.length > 0) {
    items.push({
      severity: 'medium',
      kind: 'idle-ship-queue',
      message: `${queuedMissions} mission(s) queued while ${idleShips.length} ship(s) idle: ${idleShips.join(', ')}`,
    });
  }

  // 5) Blocked dependency chains — blocked/stalled missions that gate others.
  const problemIds = new Set(
    missions.filter((m) => ['blocked', 'stalled', 'failed'].includes(m.status)).map((m) => m.id)
  );
  let blockedChains = 0;
  for (const m of missions) {
    const blockingDeps = m.depends.filter((d) => problemIds.has(d));
    if (blockingDeps.length > 0 && !['merged', 'failed'].includes(m.status)) {
      blockedChains++;
      items.push({
        severity: 'medium',
        kind: 'blocked-chain',
        missionId: m.id,
        message: `Mission ${m.id} is gated by unhealthy dependency(ies): ${blockingDeps.join(', ')}`,
      });
    }
  }

  // 6) Stale unapproved batches (supplied by the planner layer).
  const staleBatches = opts.staleBatches ?? 0;
  if (staleBatches > 0) {
    items.push({
      severity: 'low',
      kind: 'stale-batch',
      message: `${staleBatches} planner batch(es) awaiting approval past their freshness window`,
    });
  }

  const signals: RiskSignals = {
    ciFailures,
    stalledMissions: stalled.length,
    agingMissions,
    blockedChains,
    idleShips: queuedMissions > 0 ? idleShips.length : 0,
    queuedMissions,
    staleBatches,
  };

  const rawScore = items.reduce((sum, it) => sum + SEVERITY_WEIGHT[it.severity], 0);
  const score = Math.min(100, rawScore);
  const level: RiskReport['level'] =
    score === 0 ? 'healthy' : score < 25 ? 'watch' : score < 60 ? 'at-risk' : 'critical';

  // Most severe first.
  const order: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    generatedAt: now.toISOString(),
    score,
    level,
    signals,
    items,
  };
}

const LEVEL_EMOJI: Record<RiskReport['level'], string> = {
  healthy: '🟢',
  watch: '🟡',
  'at-risk': '🟠',
  critical: '🔴',
};

const SEVERITY_EMOJI: Record<RiskSeverity, string> = { high: '🔴', medium: '🟠', low: '🟡' };

/** Render a risk report as a compact text panel for `fleet report --live`. */
export function renderRiskPanel(report: RiskReport): string {
  const lines: string[] = [];
  lines.push(`Fleet Risk Panel  ${LEVEL_EMOJI[report.level]} ${report.level.toUpperCase()} (score ${report.score}/100)`);
  lines.push(`  generated: ${report.generatedAt}`);
  lines.push('');
  const s = report.signals;
  lines.push(
    `  CI failures: ${s.ciFailures} · stalled: ${s.stalledMissions} · aging: ${s.agingMissions} · ` +
      `blocked-chains: ${s.blockedChains} · idle-ships: ${s.idleShips} · queued: ${s.queuedMissions} · stale-batches: ${s.staleBatches}`
  );
  lines.push('');
  if (report.items.length === 0) {
    lines.push('  ✓ No risks detected.');
  } else {
    for (const it of report.items) {
      lines.push(`  ${SEVERITY_EMOJI[it.severity]} [${it.kind}] ${it.message}`);
    }
  }
  return lines.join('\n');
}
