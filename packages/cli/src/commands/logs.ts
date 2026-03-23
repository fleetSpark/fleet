import type { Command } from 'commander';
import {
  RealGitOps,
  parseFleetManifest,
  parseMissionLog,
} from '@fleetspark/core';
import type { MissionStep } from '@fleetspark/core';

export interface LogDisplayData {
  missionId: string;
  branch: string;
  ship: string;
  agent: string;
  status: string;
  steps: MissionStep[];
  blockers: string[];
  lastHeartbeat: Date;
}

export function formatMissionLog(data: LogDisplayData): string {
  const lines: string[] = [];
  lines.push(`Mission ${data.missionId} — ${data.branch}`);
  lines.push(`Ship: ${data.ship}  |  Agent: ${data.agent}  |  Status: ${data.status}`);
  lines.push('');
  lines.push('Steps:');
  if (data.steps.length === 0) {
    lines.push('  (none)');
  } else {
    for (const step of data.steps) {
      const check = step.done ? 'x' : ' ';
      lines.push(`  [${check}] ${step.text}`);
    }
  }
  lines.push('');
  if (data.blockers.length === 0) {
    lines.push('Blockers: none');
  } else {
    lines.push('Blockers:');
    for (const b of data.blockers) {
      lines.push(`  - ${b}`);
    }
  }
  lines.push('');
  const ago = Math.round((Date.now() - data.lastHeartbeat.getTime()) / 1000);
  const agoStr = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`;
  lines.push(`Last heartbeat: ${agoStr}`);
  return lines.join('\n');
}

export function registerLogsCommand(program: Command): void {
  program
    .command('logs <ship>')
    .description("Tail a ship's MISSION.md")
    .option('--follow', 'Poll for updates (like tail -f)')
    .action(async (shipId: string, options) => {
      const cwd = process.cwd();
      const git = new RealGitOps(cwd);

      const display = async (): Promise<string | null> => {
        try { await git.fetchBranch('fleet/state'); } catch { }
        const content = await git.readFile('origin/fleet/state', 'FLEET.md').catch(() =>
          git.readFile('fleet/state', 'FLEET.md')
        );
        const manifest = parseFleetManifest(content);
        const mission = manifest.missions.find((m) => m.ship === shipId);
        if (!mission) {
          const knownShips = manifest.missions.filter((m) => m.ship).map((m) => m.ship);
          if (knownShips.length > 0) {
            console.error(`Ship "${shipId}" not found. Known ships: ${knownShips.join(', ')}`);
          } else {
            console.error(`Ship "${shipId}" not found. No ships currently assigned.`);
          }
          return null;
        }
        try { await git.fetchBranch(mission.branch); } catch { }
        let missionContent: string;
        try {
          missionContent = await git.readFile(`origin/${mission.branch}`, 'MISSION.md');
        } catch {
          try { missionContent = await git.readFile(mission.branch, 'MISSION.md'); } catch {
            console.error(`No mission log found for ${shipId}`);
            return null;
          }
        }
        const log = parseMissionLog(missionContent);
        return formatMissionLog({
          missionId: mission.id, branch: mission.branch, ship: shipId,
          agent: log.agent, status: log.status, steps: log.steps,
          blockers: log.blockers, lastHeartbeat: log.heartbeat.lastPush,
        });
      };

      const output = await display();
      if (output === null) { process.exit(1); }
      console.log(output);

      if (options.follow) {
        let lastOutput = output;
        const interval = setInterval(async () => {
          const newOutput = await display();
          if (newOutput && newOutput !== lastOutput) {
            console.clear();
            console.log(newOutput);
            lastOutput = newOutput;
          }
        }, 10_000);
        process.on('SIGINT', () => { clearInterval(interval); process.exit(0); });
      }
    });
}
