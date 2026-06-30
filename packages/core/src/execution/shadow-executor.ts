import type { Mission, MissionStatus } from '../protocol/types.js';

/**
 * A shadow assignment duplicates a stalled mission onto a spare ship. The
 * commander accepts whichever copy (primary or shadow) completes first and
 * cancels the loser. This is the "full spare-ship shadow execution" model on
 * top of the existing stall-detection shadow-dispatch flag.
 */
export interface ShadowAssignment {
  missionId: string;
  primaryShip: string | null;
  shadowShip: string;
  /** Derived branch the shadow ship works on, isolated from the primary. */
  shadowBranch: string;
}

export type ShadowWinner = 'primary' | 'shadow' | 'pending';

export interface ShadowResolution {
  missionId: string;
  winner: ShadowWinner;
  /** Ship whose work should be cancelled once a winner is chosen. */
  cancelShip: string | null;
}

const COMPLETE_STATUSES: MissionStatus[] = ['completed', 'merge-queued', 'merged'];

function isComplete(status: MissionStatus): boolean {
  return COMPLETE_STATUSES.includes(status);
}

export class ShadowExecutor {
  /**
   * Pick a spare ship: one in the fleet that is not currently busy. Excludes
   * the mission's primary ship. Returns null when no spare is available.
   */
  selectSpareShip(allShips: string[], busyShips: Iterable<string>, excludeShip?: string | null): string | null {
    const busy = new Set(busyShips);
    if (excludeShip) busy.add(excludeShip);
    for (const ship of allShips) {
      if (!busy.has(ship)) return ship;
    }
    return null;
  }

  /**
   * Plan a shadow for a stalled mission, given the fleet's ship inventory and
   * the set of ships already busy. Returns null when no spare ship exists.
   */
  planShadow(
    mission: Mission,
    allShips: string[],
    busyShips: Iterable<string>
  ): ShadowAssignment | null {
    const shadowShip = this.selectSpareShip(allShips, busyShips, mission.ship);
    if (!shadowShip) return null;
    return {
      missionId: mission.id,
      primaryShip: mission.ship,
      shadowShip,
      shadowBranch: `${mission.branch}-shadow-${sanitizeShip(shadowShip)}`,
    };
  }

  /**
   * First-completed-wins resolution. Given the current status of the primary
   * and shadow copies, decide the winner and which ship to cancel. If both are
   * complete, the `preferShadow` flag (rare) lets callers bias; default prefers
   * the primary since it started first.
   */
  resolveFirstCompleted(
    assignment: ShadowAssignment,
    primaryStatus: MissionStatus,
    shadowStatus: MissionStatus,
    preferShadow = false
  ): ShadowResolution {
    const primaryDone = isComplete(primaryStatus);
    const shadowDone = isComplete(shadowStatus);

    if (primaryDone && shadowDone) {
      return preferShadow
        ? { missionId: assignment.missionId, winner: 'shadow', cancelShip: assignment.primaryShip }
        : { missionId: assignment.missionId, winner: 'primary', cancelShip: assignment.shadowShip };
    }
    if (primaryDone) {
      return { missionId: assignment.missionId, winner: 'primary', cancelShip: assignment.shadowShip };
    }
    if (shadowDone) {
      return { missionId: assignment.missionId, winner: 'shadow', cancelShip: assignment.primaryShip };
    }
    return { missionId: assignment.missionId, winner: 'pending', cancelShip: null };
  }
}

function sanitizeShip(ship: string): string {
  return ship.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'spare';
}
