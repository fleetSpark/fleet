import type { Command as Cmd } from 'commander';
import { readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { parse as parseYaml } from 'yaml';
import {
  RealGitOps,
  loadConfig,
  parseFleetManifest,
  writeFleetManifest,
  writeMissionLog,
  validateDAG,
  getReadyMissions,
  CommanderMonitor,
  transition,
} from '@fleet/core';
import type { FleetManifest, Mission, MissionLog, TaskBrief } from '@fleet/core';

export function registerCommandCommand(program: Cmd): void {
  program
    .command('command')
    .description('Start or resume the commander role')
    .option('--plan <goal>', 'Decompose a goal into missions using LLM')
    .option('--plan-file <path>', 'Load missions from a YAML file')
    .option('--resume', 'Resume commander from existing FLEET.md state')
    .action(async (options) => {
      const cwd = process.cwd();
      const git = new RealGitOps(cwd);
      const config = await loadConfig(cwd);

      if (options.planFile) {
        await handlePlanFile(git, cwd, config, options.planFile);
      } else if (options.plan) {
        await handlePlan(git, cwd, config, options.plan);
      } else if (options.resume) {
        await handleResume(git, config);
      } else {
        console.error(
          'Specify --plan <goal>, --plan-file <path>, or --resume'
        );
        process.exit(1);
      }
    });
}

async function handlePlanFile(
  git: RealGitOps,
  cwd: string,
  config: any,
  planFilePath: string
): Promise<void> {
  const content = await readFile(planFilePath, 'utf-8');
  const planData = parseYaml(content) as {
    missions: Array<{
      id: string;
      branch: string;
      brief: string;
      agent?: string;
      depends?: string[];
    }>;
  };

  const missions: Mission[] = planData.missions.map((m) => ({
    id: m.id,
    branch: m.branch,
    ship: null,
    agent: m.agent ?? 'claude-code',
    status: 'pending' as const,
    depends: m.depends ?? [],
    blocker: 'none',
  }));

  // Validate DAG
  const dagResult = validateDAG(missions);
  if (!dagResult.valid) {
    console.error('Circular dependency detected:', dagResult.cycles);
    process.exit(1);
  }

  // Transition independent missions to ready
  for (const mission of missions) {
    if (mission.depends.length === 0) {
      mission.status = transition(mission.status, 'dependencies_met');
    }
  }

  // Write FLEET.md
  const manifest: FleetManifest = {
    updated: new Date(),
    commander: {
      host: hostname(),
      lastCheckin: new Date(),
      status: 'active',
      timeoutMinutes: 15,
    },
    missions,
    mergeQueue: [],
    completed: [],
  };

  await git.writeAndPush(
    'fleet/state',
    'FLEET.md',
    writeFleetManifest(manifest),
    'fleet: create missions from plan file'
  );

  // Create feature branches and initial MISSION.md for each mission
  for (const mission of missions) {
    const brief = planData.missions.find((m) => m.id === mission.id)?.brief ?? '';
    await git.createBranch(mission.branch, 'main');

    const missionLog: MissionLog = {
      branch: mission.branch,
      ship: '',
      agent: mission.agent,
      status: 'pending',
      brief,
      steps: [],
      blockers: [],
      heartbeat: { lastPush: new Date(), pushInterval: config.heartbeat.interval_seconds },
    };

    await git.writeAndPush(
      mission.branch,
      'MISSION.md',
      writeMissionLog(missionLog),
      'fleet: initialize mission'
    );

    // Write .fleet/task_brief.json per protocol spec
    const taskBrief: TaskBrief = {
      mission_id: mission.id,
      branch: mission.branch,
      ship_id: '',
      adapter: mission.agent,
      description: brief,
      depends_on: mission.depends,
      context_file: null,
      created_at: new Date().toISOString(),
    };

    await git.writeAndPush(
      mission.branch,
      '.fleet/task_brief.json',
      JSON.stringify(taskBrief, null, 2),
      'fleet: add task brief'
    );
  }

  const remoteUrl = await git.getRemoteUrl();
  console.log(`Commander running. ${missions.length} missions created.`);
  console.log('');
  console.log('Ships can join with:');
  console.log(`  fleet ship --join ${remoteUrl}`);

  // Start monitoring loop
  await startMonitorLoop(git, config);
}

async function handlePlan(
  git: RealGitOps,
  cwd: string,
  config: any,
  goal: string
): Promise<void> {
  console.log('Planning missions with LLM...');

  // Dynamic import to avoid requiring @anthropic-ai/sdk unless --plan is used
  let Anthropic: any;
  try {
    const mod = await import('@anthropic-ai/sdk' as string);
    Anthropic = mod.default ?? mod.Anthropic;
  } catch {
    console.error(
      'The --plan option requires @anthropic-ai/sdk. Install it with:\n' +
      '  npm install @anthropic-ai/sdk'
    );
    process.exit(1);
  }
  const client = new Anthropic();

  const response = await client.messages.create({
    model: config.commander.model,
    max_tokens: 4096,
    system: `You are a mission planner for Fleet, a multi-machine orchestration tool for AI coding agents.
Decompose the given goal into independent missions that can run in parallel where possible.
Return ONLY valid JSON in this format:
{
  "missions": [
    { "id": "M1", "branch": "feature/short-name", "brief": "Clear task description", "agent": "claude-code", "depends": [] },
    { "id": "M2", "branch": "feature/other", "brief": "Another task", "agent": "claude-code", "depends": ["M1"] }
  ]
}`,
    messages: [{ role: 'user', content: goal }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('LLM did not return valid JSON. Response:', text);
    process.exit(1);
  }

  const planData = JSON.parse(jsonMatch[0]);

  // Write a temporary plan file and delegate to handlePlanFile
  const { writeFile: wf } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { stringify } = await import('yaml');
  const tmpPath = join(cwd, '.fleet', 'last-plan.yml');
  await wf(tmpPath, stringify(planData), 'utf-8');

  await handlePlanFile(git, cwd, config, tmpPath);
}

async function handleResume(git: RealGitOps, config: any): Promise<void> {
  const content = await git.readFile('fleet/state', 'FLEET.md');
  const manifest = parseFleetManifest(content);

  // Claim commander role
  manifest.commander.host = hostname();
  manifest.commander.lastCheckin = new Date();
  manifest.commander.status = 'active';
  manifest.updated = new Date();

  await git.writeAndPush(
    'fleet/state',
    'FLEET.md',
    writeFleetManifest(manifest),
    'fleet: resume commander role'
  );

  const active = manifest.missions.filter(
    (m) => !['completed', 'merged', 'failed'].includes(m.status)
  );
  console.log(`Resumed commander role. ${active.length} active missions.`);

  await startMonitorLoop(git, config);
}

async function startMonitorLoop(git: RealGitOps, config: any): Promise<void> {
  const monitor = new CommanderMonitor(git, {
    stallThresholdMin: config.execution.stall_threshold_min,
    unresponsiveThresholdMin: config.execution.unresponsive_threshold_min,
  });

  const pollMs = config.commander.poll_interval_minutes * 60 * 1000;

  const doPoll = async () => {
    try {
      const content = await git.readFile('fleet/state', 'FLEET.md');
      const manifest = parseFleetManifest(content);
      const health = await monitor.poll(manifest.missions);

      let changed = false;
      for (const h of health) {
        const mission = manifest.missions.find((m) => m.id === h.missionId);
        if (!mission) continue;

        if (h.status === 'dead' && mission.status === 'in-progress') {
          mission.status = 'stalled';
          mission.blocker = 'Ship unresponsive';
          changed = true;
        }
      }

      // Check for newly ready missions (dependencies resolved)
      const ready = getReadyMissions(manifest.missions);
      for (const m of ready) {
        m.status = transition(m.status, 'dependencies_met');
        changed = true;
      }

      if (changed) {
        manifest.updated = new Date();
        manifest.commander.lastCheckin = new Date();
        await git.writeAndPush(
          'fleet/state',
          'FLEET.md',
          writeFleetManifest(manifest),
          'fleet: commander poll update'
        );
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  };

  console.log(
    `Commander monitoring every ${config.commander.poll_interval_minutes}m. Ctrl+C to stop.`
  );
  await doPoll();
  setInterval(() => void doPoll(), pollMs);
}
