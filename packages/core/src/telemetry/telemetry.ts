import type { FleetManifest } from '../protocol/types.js';

export interface TelemetrySnapshot {
  timestamp: Date;
  missions: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    merged: number;
  };
  ships: {
    active: number;
    idle: number;
    utilizationPct: number;
  };
  throughput: {
    completedPerHour: number;
    avgMissionDurationMin: number;
  };
}

export class TelemetryCollector {
  private history: TelemetrySnapshot[] = [];

  constructor(private maxHistory: number = 100) {}

  snapshot(manifest: FleetManifest): TelemetrySnapshot {
    const pending = manifest.missions.filter(
      (m) => m.status === 'pending' || m.status === 'ready',
    ).length;
    const inProgress = manifest.missions.filter(
      (m) => m.status === 'in-progress' || m.status === 'assigned',
    ).length;
    const completed = manifest.missions.filter(
      (m) => m.status === 'completed',
    ).length;
    const failed = manifest.missions.filter(
      (m) => m.status === 'failed',
    ).length;
    const merged = manifest.missions.filter(
      (m) => m.status === 'merged' || m.status === 'merge-queued',
    ).length;

    // Ships: any mission with a non-null ship that is in-progress/assigned is active
    const activeShips = new Set<string>();
    const allShips = new Set<string>();
    for (const m of manifest.missions) {
      if (m.ship) {
        allShips.add(m.ship);
        if (m.status === 'in-progress' || m.status === 'assigned') {
          activeShips.add(m.ship);
        }
      }
    }
    const active = activeShips.size;
    const idle = allShips.size - active;
    const totalShips = active + idle;
    const utilizationPct = totalShips > 0 ? (active / totalShips) * 100 : 0;

    // Throughput: based on history window
    const now = new Date();
    let completedPerHour = 0;
    let avgMissionDurationMin = 0;

    if (this.history.length > 0) {
      const oldest = this.history[0];
      const windowMs = now.getTime() - oldest.timestamp.getTime();
      const windowHours = windowMs / (1000 * 60 * 60);
      // Count completed entries in manifest as proxy for total completed
      const totalCompleted = manifest.completed.length;
      if (windowHours > 0) {
        completedPerHour = totalCompleted / windowHours;
      }
    }

    // Average mission duration from completed entries
    if (manifest.completed.length > 0) {
      const manifestCreated = manifest.updated;
      // Use completed entries' mergedDate to estimate durations
      const durations = manifest.completed.map((c) => {
        const mergedTime = new Date(c.mergedDate).getTime();
        const createdTime = new Date(manifestCreated).getTime();
        return Math.abs(mergedTime - createdTime) / (1000 * 60);
      });
      avgMissionDurationMin =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;
    }

    const snap: TelemetrySnapshot = {
      timestamp: now,
      missions: {
        total: manifest.missions.length,
        pending,
        inProgress,
        completed,
        failed,
        merged,
      },
      ships: {
        active,
        idle,
        utilizationPct: Math.round(utilizationPct * 100) / 100,
      },
      throughput: {
        completedPerHour: Math.round(completedPerHour * 100) / 100,
        avgMissionDurationMin: Math.round(avgMissionDurationMin * 100) / 100,
      },
    };

    this.history.push(snap);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }

    return snap;
  }

  getHistory(): TelemetrySnapshot[] {
    return [...this.history];
  }

  summary(): string {
    if (this.history.length === 0) {
      return 'No telemetry data collected yet.';
    }

    const latest = this.history[this.history.length - 1];
    const lines = [
      '=== Fleet Telemetry ===',
      `Timestamp: ${latest.timestamp.toISOString()}`,
      '',
      'Missions:',
      `  Total: ${latest.missions.total}`,
      `  Pending: ${latest.missions.pending}`,
      `  In-Progress: ${latest.missions.inProgress}`,
      `  Completed: ${latest.missions.completed}`,
      `  Failed: ${latest.missions.failed}`,
      `  Merged: ${latest.missions.merged}`,
      '',
      'Ships:',
      `  Active: ${latest.ships.active}`,
      `  Idle: ${latest.ships.idle}`,
      `  Utilization: ${latest.ships.utilizationPct}%`,
      '',
      'Throughput:',
      `  Completed/hour: ${latest.throughput.completedPerHour}`,
      `  Avg duration: ${latest.throughput.avgMissionDurationMin} min`,
    ];

    return lines.join('\n');
  }
}
