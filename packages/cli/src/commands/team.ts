import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  RealGitOps,
  loadConfig,
  parseFleetManifest,
  parseTeamConfig,
  routeReviewers,
  evaluateApproval,
} from '@fleetspark/core';
import type { TeamConfig } from '@fleetspark/core';

async function loadTeam(cwd: string): Promise<TeamConfig | null> {
  try {
    const raw = await readFile(join(cwd, '.fleet', 'team.yml'), 'utf-8');
    return parseTeamConfig(parseYaml(raw));
  } catch {
    return null;
  }
}

export function registerTeamCommand(program: Command): void {
  const team = program
    .command('team')
    .description('Team Lite — ownership lanes, reviewer routing, and approval policy');

  team
    .command('show')
    .description('Show the team roster and ownership lanes (.fleet/team.yml)')
    .action(async () => {
      const cwd = process.cwd();
      const config = await loadTeam(cwd);
      if (!config) {
        console.error('No .fleet/team.yml found. Create one to enable Team Lite.');
        process.exit(1);
      }
      console.log('Members:');
      for (const m of config.members) {
        console.log(`  ${m.name} — ${m.roles.join(', ') || 'contributor'}`);
      }
      console.log('\nOwnership lanes:');
      for (const r of config.ownership) {
        const reviewers = r.reviewers?.length ? ` (reviewers: ${r.reviewers.join(', ')})` : '';
        console.log(`  ${r.pattern} → ${r.owner}${reviewers}`);
      }
      console.log('\nApproval policy:');
      console.log(`  minReviewers: ${config.approval.minReviewers}, requireOwner: ${config.approval.requireOwner}`);
    });

  team
    .command('route <missionId>')
    .description("Compute owner and reviewers for a mission's changed files")
    .action(async (missionId: string) => {
      const cwd = process.cwd();
      const teamConfig = await loadTeam(cwd);
      if (!teamConfig) {
        console.error('No .fleet/team.yml found.');
        process.exit(1);
      }

      const git = new RealGitOps(cwd);
      const fleetConfig = await loadConfig(cwd);
      const target = fleetConfig.merge?.target_branch ?? 'main';

      let mission;
      try {
        const content = await git.readFile('fleet/state', 'FLEET.md');
        mission = parseFleetManifest(content).missions.find((m) => m.id === missionId);
      } catch {
        console.error('No fleet state found.');
        process.exit(1);
      }
      if (!mission) {
        console.error(`Mission ${missionId} not found.`);
        process.exit(1);
      }

      let files: string[] = [];
      try {
        files = await git.diffNameOnly(target, mission.branch);
      } catch {
        console.error(`Could not diff ${target}...${mission.branch}.`);
        process.exit(1);
      }

      const routing = routeReviewers(teamConfig, files);
      const approval = evaluateApproval(teamConfig, [], files);
      console.log(`Mission ${missionId} (${files.length} changed files)`);
      console.log(`  Owner: ${routing.owner ?? '— (unowned)'}`);
      console.log(`  Reviewers: ${routing.reviewers.join(', ') || '—'}`);
      if (routing.unowned.length) {
        console.log(`  Unowned files: ${routing.unowned.length}`);
      }
      console.log(`  Approval policy: needs ${approval.requiredReviewers} reviewer(s)${teamConfig.approval.requireOwner ? ' + owner' : ''}`);
    });
}
