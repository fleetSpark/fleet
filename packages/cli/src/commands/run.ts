import type { Command } from 'commander';
import * as readline from 'node:readline';
import { loadConfig, getTemplate, resolveAdapter, PluginLoader } from '@fleetspark/core';
import type { FleetPlugin, FleetContext } from '@fleetspark/core';
import type { Mission } from '@fleetspark/core';

// ── Topological sort ─────────────────────────────────────────────────────────

interface TemplateMission {
  id: string;
  branch: string;
  brief: string;
  agent: string;
  depends: string[];
}

export function topoSort(missions: TemplateMission[]): TemplateMission[] {
  const byId = new Map(missions.map((m) => [m.id, m]));
  const visited = new Set<string>();
  const result: TemplateMission[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const m = byId.get(id);
    if (!m) return;
    for (const dep of m.depends) visit(dep);
    result.push(m);
  }

  for (const m of missions) visit(m.id);
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitForEnter(prompt: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

function pollUntilDone(
  check: () => Promise<boolean>,
  intervalMs = 10_000
): Promise<void> {
  return new Promise((resolve) => {
    const id = setInterval(async () => {
      const alive = await check();
      if (!alive) { clearInterval(id); resolve(); }
    }, intervalMs);
  });
}

function toMission(tm: TemplateMission): Mission {
  return {
    id: tm.id,
    branch: tm.branch,
    ship: 'local',
    agent: tm.agent,
    status: 'in-progress',
    depends: tm.depends,
    blocker: '',
  };
}

function dim(s: string) { return `\x1b[2m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function red(s: string) { return `\x1b[31m${s}\x1b[0m`; }
function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }

// ── Gate check with interactive retry ─────────────────────────────────────────

async function runGateCheck(
  plugins: FleetPlugin[],
  mission: Mission,
  context: FleetContext,
  label: string
): Promise<void> {
  for (const plugin of plugins) {
    const hook = label === 'start' ? plugin.onBeforeMissionStart : plugin.onBeforeMerge;
    if (!hook) continue;

    let result = await hook.call(plugin, mission, context);
    while (result.block) {
      console.log(yellow(`\n  ⚠  Gate check failed (${plugin.name}):`));
      console.log(`     ${result.reason ?? 'No reason provided.'}`);
      await waitForEnter(`\n  Update ${label === 'start' ? 'workstreams.json' : 'workstreams.json / merge_gate'} then press Enter to re-check...`);
      result = await hook.call(plugin, mission, context);
    }
  }
  console.log(green(`  ✓ Gate passed`));
}

// ── Command ───────────────────────────────────────────────────────────────────

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run a template locally in sequence — single machine, no extra ships needed')
    .requiredOption('--template <name>', 'Built-in mission template to run')
    .option('--cwd <path>', 'Working directory (default: current directory)')
    .option('--agent <adapter>', 'Override the agent adapter for all missions')
    .action(async (options: { template: string; cwd?: string; agent?: string }) => {
      const workDir = options.cwd ?? process.cwd();

      // Load template
      const template = getTemplate(options.template);
      if (!template) {
        console.error(red(`Unknown template: "${options.template}"`));
        console.error(`Run "fleet command --template list" to see available templates.`);
        process.exit(1);
      }

      // Load config + plugins
      const config = await loadConfig(workDir);
      const loader = new PluginLoader();
      await loader.load(config.plugins ?? []);
      const plugins = loader.getPlugins();
      const context: FleetContext = { workDir };

      // Sort missions
      const missions = topoSort(template.missions);

      // Header
      console.log(`\n${bold('⚡ Fleet Run')} — ${template.name}`);
      console.log(dim(template.description));
      console.log(dim(`\n${missions.length} missions · sequential · local execution`));
      if (plugins.length > 0) {
        console.log(dim(`Plugins: ${plugins.map((p) => p.name).join(', ')}`));
      }
      console.log('');

      const startTime = Date.now();

      for (let i = 0; i < missions.length; i++) {
        const tm = options.agent ? { ...missions[i], agent: options.agent } : missions[i];
        const mission = toMission(tm);
        const missionNum = `${i + 1}/${missions.length}`;

        console.log(`${'─'.repeat(50)}`);
        console.log(bold(`Mission ${missionNum}: ${tm.id}`));
        console.log(dim(`Branch: ${tm.branch}`));
        console.log(dim(`Agent:  ${tm.agent}`));
        if (tm.depends.length > 0) {
          console.log(dim(`Depends: ${tm.depends.join(', ')}`));
        }
        console.log('');

        // Before-start gate
        if (plugins.length > 0) {
          process.stdout.write(dim('  Checking start gate...\n'));
          await runGateCheck(plugins, mission, context, 'start');
        }

        // Show brief (truncated for terminal)
        const briefPreview = tm.brief.length > 200
          ? tm.brief.slice(0, 200) + '…'
          : tm.brief;
        console.log(`\n  ${dim('Brief:')} ${briefPreview}\n`);

        // Spawn adapter
        let adapter;
        try {
          adapter = await resolveAdapter(tm.agent);
        } catch {
          console.error(red(`  Could not load adapter "${tm.agent}". Is @fleetspark/adapter-${tm.agent} installed?`));
          process.exit(1);
        }

        console.log(dim(`  Starting ${tm.agent}...`));
        let session;
        try {
          session = await adapter.start(
            { id: tm.id, branch: tm.branch, brief: tm.brief, agent: tm.agent, depends: tm.depends },
            undefined
          );
          console.log(dim(`  Agent running (PID ${session.pid})`));
        } catch (err) {
          console.error(red(`  Failed to start agent: ${String(err)}`));
          process.exit(1);
        }

        // Wait for completion
        await pollUntilDone(() => adapter.isAlive(session));
        console.log(green(`\n  ✓ Mission ${tm.id} complete`));

        // Between-mission merge gate check (not after the last mission)
        if (i < missions.length - 1 && plugins.length > 0) {
          console.log('');
          process.stdout.write(dim(`  Checking merge gate before mission ${i + 2}...\n`));
          await runGateCheck(plugins, mission, context, 'merge');
        }

        console.log('');
      }

      // Summary
      const elapsed = Math.round((Date.now() - startTime) / 60_000);
      console.log(`${'═'.repeat(50)}`);
      console.log(bold(green(`⚡ All ${missions.length} missions complete!`)));
      console.log(dim(`Total time: ~${elapsed} min\n`));
      console.log('Branches created during this run:');
      for (const m of missions) {
        console.log(`  ${green('✓')} ${m.branch}`);
      }
      console.log(`\nRun ${bold('fleet report')} for a full summary, or open PRs to merge.\n`);
    });
}
