import type { GitOps } from '../git/git-ops.js';
import type { Mission } from '../protocol/types.js';

export interface ConflictReport {
  missionId: string;
  branch: string;
  overlappingFiles: Array<{
    file: string;
    conflictsWith: string;
  }>;
}

export class ConflictDetector {
  constructor(private gitOps: GitOps) {}

  async check(mission: Mission, activeMissions: Mission[]): Promise<ConflictReport> {
    const report: ConflictReport = {
      missionId: mission.id,
      branch: mission.branch,
      overlappingFiles: [],
    };

    let myFiles: string[];
    try {
      myFiles = await this.gitOps.diffNameOnly('main', mission.branch);
    } catch {
      return report;
    }

    for (const other of activeMissions) {
      if (other.id === mission.id) continue;
      if (!['in-progress', 'completed', 'merge-queued'].includes(other.status)) continue;

      try {
        const theirFiles = await this.gitOps.diffNameOnly('main', other.branch);
        const overlap = myFiles.filter((f) => theirFiles.includes(f));
        for (const file of overlap) {
          report.overlappingFiles.push({ file, conflictsWith: other.branch });
        }
      } catch {
        // Branch may not exist or have diverged — skip
      }
    }

    return report;
  }
}
