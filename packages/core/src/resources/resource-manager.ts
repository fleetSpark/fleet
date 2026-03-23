import type { FleetManifest, Mission } from '../protocol/types.js';

export interface ResourceConfig {
  maxMissionsPerShip: number;
  maxConcurrentShips: number;
  missionTimeoutMin: number;
}

export class ResourceManager {
  constructor(private config: ResourceConfig) {}

  canAssignMission(shipId: string, manifest: FleetManifest): { allowed: boolean; reason?: string } {
    // Check per-ship limit
    const shipMissions = manifest.missions.filter(
      (m) => m.ship === shipId && m.status === 'in-progress'
    );
    if (shipMissions.length >= this.config.maxMissionsPerShip) {
      return { allowed: false, reason: `Ship ${shipId} already running ${shipMissions.length} missions (max: ${this.config.maxMissionsPerShip})` };
    }

    // Check global ship count
    const activeShips = new Set(
      manifest.missions
        .filter((m) => m.status === 'in-progress' && m.ship)
        .map((m) => m.ship)
    );
    if (!activeShips.has(shipId) && activeShips.size >= this.config.maxConcurrentShips) {
      return { allowed: false, reason: `Fleet at max concurrent ships (${this.config.maxConcurrentShips})` };
    }

    return { allowed: true };
  }

  /**
   * Check for timed-out missions using per-mission heartbeat timestamps.
   * Falls back to manifest.updated only when individual timestamps are unavailable.
   * @param heartbeatTimestamps - Map of missionId → last heartbeat push time
   */
  getTimedOutMissions(
    manifest: FleetManifest,
    now: Date = new Date(),
    heartbeatTimestamps?: Map<string, Date>
  ): Mission[] {
    if (!this.config.missionTimeoutMin || this.config.missionTimeoutMin <= 0) return [];

    const timeoutMs = this.config.missionTimeoutMin * 60 * 1000;
    return manifest.missions.filter((m) => {
      if (m.status !== 'in-progress') return false;
      // Use per-mission heartbeat timestamp if available, otherwise manifest.updated
      const lastActive = heartbeatTimestamps?.get(m.id) ?? manifest.updated;
      const elapsed = now.getTime() - lastActive.getTime();
      return elapsed > timeoutMs;
    });
  }
}
