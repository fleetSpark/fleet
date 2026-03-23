import type { GitOps } from '../git/git-ops.js';
import type { MissionLog, MissionStep } from '../protocol/types.js';
import { writeMissionLog } from '../protocol/mission-log.js';

export class ShipHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;
  private log: MissionLog | null = null;

  constructor(
    private gitOps: GitOps,
    private intervalSeconds: number
  ) {}

  start(missionLog: MissionLog): void {
    this.log = { ...missionLog };
    this.timer = setInterval(() => {
      void this.push();
    }, this.intervalSeconds * 1000);
  }

  updateProgress(steps: MissionStep[]): void {
    if (this.log) {
      this.log.steps = steps;
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Final push
    void this.push();
  }

  private async push(): Promise<void> {
    if (!this.log) return;

    this.log.heartbeat.lastPush = new Date();
    const content = writeMissionLog(this.log);

    await this.gitOps.writeAndPush(
      this.log.branch,
      'MISSION.md',
      content,
      `heartbeat: ${this.log.heartbeat.lastPush.toISOString()}`
    );
  }
}
