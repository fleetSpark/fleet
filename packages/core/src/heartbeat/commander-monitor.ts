import type { GitOps } from '../git/git-ops.js';
import type { Mission } from '../protocol/types.js';
import { parseMissionLog } from '../protocol/mission-log.js';

export interface MonitorConfig {
  stallThresholdMin: number;
  unresponsiveThresholdMin: number;
}

export interface ShipHealth {
  missionId: string;
  ship: string;
  status: 'alive' | 'stale' | 'dead';
  lastSeen: Date;
  stepProgress: string;
}

export class CommanderMonitor {
  constructor(
    private gitOps: GitOps,
    private config: MonitorConfig
  ) {}

  async poll(missions: Mission[]): Promise<ShipHealth[]> {
    const activeMissions = missions.filter(
      (m) => m.status === 'in-progress' && m.ship
    );

    const results: ShipHealth[] = [];

    for (const mission of activeMissions) {
      try {
        const content = await this.gitOps.readFile(
          mission.branch,
          'MISSION.md'
        );
        const log = parseMissionLog(content);
        const lastPush = log.heartbeat.lastPush;
        const minutesAgo = (Date.now() - lastPush.getTime()) / 60_000;

        const doneSteps = log.steps.filter((s) => s.done).length;
        const totalSteps = log.steps.length;

        let status: ShipHealth['status'];
        if (minutesAgo > this.config.stallThresholdMin) {
          // Past stall threshold (30min default) → dead (truly unresponsive)
          status = 'dead';
        } else if (minutesAgo > this.config.unresponsiveThresholdMin) {
          // Past unresponsive threshold (10min default) but within stall → stale
          status = 'stale';
        } else {
          status = 'alive';
        }

        results.push({
          missionId: mission.id,
          ship: mission.ship!,
          status,
          lastSeen: lastPush,
          stepProgress: `${doneSteps}/${totalSteps} steps`,
        });
      } catch {
        results.push({
          missionId: mission.id,
          ship: mission.ship!,
          status: 'dead',
          lastSeen: new Date(0),
          stepProgress: 'unknown',
        });
      }
    }

    return results;
  }
}
