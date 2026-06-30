import type { FleetManifest, Mission } from '../protocol/types.js';

export interface ReplayOutcome {
  ok: boolean;
  error?: string;
  mission?: Mission;
}

/**
 * Reset a mission so it can be re-run from scratch. Clears the ship assignment,
 * blocker, and any completed/merge-queue records, and returns it to the
 * scheduler: `ready` when it has no dependencies, otherwise `pending`.
 *
 * Mutates the passed manifest in place (matching the commander's manifest
 * handling) and returns the affected mission.
 */
export function applyReplay(manifest: FleetManifest, missionId: string): ReplayOutcome {
  const mission = manifest.missions.find((m) => m.id === missionId);
  if (!mission) {
    return { ok: false, error: `Mission "${missionId}" not found` };
  }

  mission.ship = null;
  mission.blocker = 'none';
  mission.status = mission.depends.length === 0 ? 'ready' : 'pending';

  // Drop any terminal records so the merge commander treats it as fresh.
  manifest.mergeQueue = manifest.mergeQueue.filter((e) => e.missionId !== missionId);
  manifest.completed = manifest.completed.filter((c) => c.missionId !== missionId);
  manifest.updated = new Date();

  return { ok: true, mission };
}
