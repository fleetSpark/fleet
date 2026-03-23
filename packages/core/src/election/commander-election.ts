import type { FleetManifest } from '../protocol/types.js';
import type { GitOps } from '../git/git-ops.js';
import { parseFleetManifest } from '../protocol/fleet-manifest.js';
import { writeFleetManifest } from '../protocol/fleet-manifest.js';

const STATE_BRANCH = 'fleet/state';
const MANIFEST_PATH = 'FLEET.md';

export interface ClaimResult {
  canClaim: boolean;
  reason: string;
}

export class CommanderElection {
  /**
   * Checks whether the given host can claim commander leadership
   * based on the current manifest state.
   */
  canClaim(manifest: FleetManifest, myHostId: string): ClaimResult {
    const { commander } = manifest;

    // No commander exists (empty host)
    if (!commander.host) {
      return { canClaim: true, reason: 'No commander currently assigned' };
    }

    // I am already the commander
    if (commander.host === myHostId) {
      return { canClaim: true, reason: 'Already the current commander' };
    }

    // Commander is explicitly offline or transferred
    if (commander.status === 'offline' || commander.status === 'transferred') {
      return { canClaim: true, reason: `Commander status is ${commander.status}` };
    }

    // Commander has timed out
    const elapsed = (Date.now() - commander.lastCheckin.getTime()) / 60_000;
    if (elapsed > commander.timeoutMinutes) {
      return {
        canClaim: true,
        reason: `Commander timed out (${Math.round(elapsed)}min since last checkin, timeout is ${commander.timeoutMinutes}min)`,
      };
    }

    // Commander is active and it's someone else
    return {
      canClaim: false,
      reason: `Commander ${commander.host} is active (last checkin ${Math.round(elapsed)}min ago)`,
    };
  }

  /**
   * Atomically tries to claim commander leadership using optimistic locking.
   * Read → check → write → push. If push fails, another node won the race.
   */
  async claim(gitOps: GitOps, myHostId: string): Promise<boolean> {
    try {
      // Read current manifest
      const content = await gitOps.readFile(STATE_BRANCH, MANIFEST_PATH);
      const manifest = parseFleetManifest(content);

      // Check eligibility
      const result = this.canClaim(manifest, myHostId);
      if (!result.canClaim) {
        return false;
      }

      // Update commander info
      manifest.commander = {
        host: myHostId,
        lastCheckin: new Date(),
        status: 'active',
        timeoutMinutes: manifest.commander.timeoutMinutes || 15,
      };
      manifest.updated = new Date();

      // Write and push — if push fails due to conflict, another node won
      const newContent = writeFleetManifest(manifest);
      await gitOps.writeAndPush(
        STATE_BRANCH,
        MANIFEST_PATH,
        newContent,
        `election: ${myHostId} claims commander`
      );

      return true;
    } catch {
      // Push conflict or other error — another node won the election
      return false;
    }
  }

  /**
   * Updates the commander's last checkin timestamp.
   */
  async heartbeat(gitOps: GitOps, myHostId: string): Promise<void> {
    const content = await gitOps.readFile(STATE_BRANCH, MANIFEST_PATH);
    const manifest = parseFleetManifest(content);

    if (manifest.commander.host !== myHostId) {
      throw new Error(
        `Cannot heartbeat: current commander is ${manifest.commander.host}, not ${myHostId}`
      );
    }

    manifest.commander.lastCheckin = new Date();
    manifest.updated = new Date();

    const newContent = writeFleetManifest(manifest);
    await gitOps.writeAndPush(
      STATE_BRANCH,
      MANIFEST_PATH,
      newContent,
      `heartbeat: ${myHostId} checkin`
    );
  }

  /**
   * Gracefully releases commander leadership.
   */
  async release(gitOps: GitOps, myHostId: string): Promise<void> {
    const content = await gitOps.readFile(STATE_BRANCH, MANIFEST_PATH);
    const manifest = parseFleetManifest(content);

    if (manifest.commander.host !== myHostId) {
      throw new Error(
        `Cannot release: current commander is ${manifest.commander.host}, not ${myHostId}`
      );
    }

    manifest.commander.status = 'offline';
    manifest.updated = new Date();

    const newContent = writeFleetManifest(manifest);
    await gitOps.writeAndPush(
      STATE_BRANCH,
      MANIFEST_PATH,
      newContent,
      `election: ${myHostId} releases commander`
    );
  }
}
