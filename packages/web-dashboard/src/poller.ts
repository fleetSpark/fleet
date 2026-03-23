import { EventEmitter } from 'node:events';
import type {
  FleetManifest,
  MissionLog,
  TelemetrySnapshot,
} from '@fleetspark/core';
import {
  RealGitOps,
  parseFleetManifest,
  parseMissionLog,
  TelemetryCollector,
} from '@fleetspark/core';

export interface StateSnapshot {
  manifest: FleetManifest;
  logs: Map<string, MissionLog>;
  telemetry: TelemetrySnapshot;
  fetchedAt: Date;
}

export class GitPoller extends EventEmitter {
  private git: RealGitOps;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastUpdated: string | null = null;
  private telemetry: TelemetryCollector;

  constructor(
    private cwd: string,
    private intervalMs: number = 15_000,
  ) {
    super();
    this.git = new RealGitOps(cwd);
    this.telemetry = new TelemetryCollector();
  }

  start(): void {
    const poll = async (): Promise<void> => {
      try {
        await this.git.fetchBranch('fleet/state');
        const content = await this.git.readFile('origin/fleet/state', 'FLEET.md');
        const manifest = parseFleetManifest(content);

        const updatedStr = manifest.updated.toISOString();
        if (updatedStr === this.lastUpdated) {
          return;
        }
        this.lastUpdated = updatedStr;

        const logs = new Map<string, MissionLog>();
        for (const mission of manifest.missions) {
          if (
            mission.status === 'in-progress' ||
            mission.status === 'assigned' ||
            mission.status === 'completed' ||
            mission.status === 'merge-queued'
          ) {
            try {
              await this.git.fetchBranch(mission.branch);
              const logContent = await this.git.readFile(
                `origin/${mission.branch}`,
                'MISSION.md',
              );
              logs.set(mission.id, parseMissionLog(logContent));
            } catch {
              // Branch may not exist yet — skip
            }
          }
        }

        const telemetrySnap = this.telemetry.snapshot(manifest);

        const snapshot: StateSnapshot = {
          manifest,
          logs,
          telemetry: telemetrySnap,
          fetchedAt: new Date(),
        };

        this.emit('update', snapshot);
      } catch (err) {
        this.emit('error', err);
      }
    };

    void poll();
    this.timer = setInterval(() => void poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
