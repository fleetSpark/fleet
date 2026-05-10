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
function cyan(s: string) { return `\x1b[36m${s}\x1b[0m`; }

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

// ── Simulate mode ─────────────────────────────────────────────────────────────

export interface SimulateOptions {
  /** Override agent name shown for all missions */
  agentOverride?: string;
  /** Delay in ms between simulate steps (default 400) */
  delayMs?: number;
  /** Sink for output lines (default: no-op for testing) */
  emit?: (line: string) => void;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

/** Runs a simulated fleet run — no real agents, no plugins, no git.
 *  Returns all output lines so tests can assert on them. */
export async function runSimulate(
  templateName: string,
  options: SimulateOptions = {}
): Promise<string[]> {
  const { agentOverride, delayMs = 400, emit: userEmit } = options;
  const output: string[] = [];

  const emit = (line: string): void => {
    output.push(line);
    if (userEmit) userEmit(line);
  };

  const template = getTemplate(templateName);
  if (!template) {
    emit(red(`Unknown template: "${templateName}"`));
    return output;
  }

  const missions = topoSort(template.missions as TemplateMission[]);
  const agentLabel = agentOverride ?? 'claude-code';

  // Header
  emit('');
  emit(bold('⚡ Fleet Run') + ` — ${template.name} ${cyan('[SIMULATE]')}`);
  emit(dim(template.description));
  emit(dim(`\n${missions.length} missions · sequential · simulated (no real agents)`));
  emit('');

  const startTime = Date.now();

  for (let i = 0; i < missions.length; i++) {
    const tm = agentOverride ? { ...missions[i], agent: agentOverride } : missions[i];
    const missionNum = `${i + 1}/${missions.length}`;

    emit(`${'─'.repeat(50)}`);
    emit(bold(`Mission ${missionNum}: ${tm.id}`));
    emit(dim(`Branch: ${tm.branch}`));
    emit(dim(`Agent:  ${agentLabel}`));
    if (tm.depends.length > 0) {
      emit(dim(`Depends: ${tm.depends.join(', ')}`));
    }
    emit('');

    // Simulated gate check
    emit(dim('  Checking start gate...'));
    await sleep(delayMs * 0.5);
    emit(green('  ✓ Gate passed') + dim(' [simulated]'));

    // Brief preview
    const briefPreview = tm.brief.length > 200 ? tm.brief.slice(0, 200) + '…' : tm.brief;
    emit(`\n  ${dim('Brief:')} ${briefPreview}\n`);

    // Simulated agent start
    const fakePid = 10000 + Math.floor(i * 1337 + 42);
    emit(dim(`  Starting ${agentLabel}...`));
    await sleep(delayMs * 0.5);
    emit(dim(`  Agent running (PID ${fakePid}) [simulated]`));

    // Simulated execution
    await sleep(delayMs);
    emit(green(`\n  ✓ Mission ${tm.id} complete`) + dim(' [simulated]'));

    // Simulated merge gate check between missions
    if (i < missions.length - 1) {
      emit('');
      emit(dim(`  Checking merge gate before mission ${i + 2}...`));
      await sleep(delayMs * 0.3);
      emit(green('  ✓ Gate passed') + dim(' [simulated]'));
    }

    emit('');
  }

  // Summary
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  emit(`${'═'.repeat(50)}`);
  emit(bold(green(`⚡ All ${missions.length} missions complete!`)) + dim(' [simulated]'));
  emit(dim(`Total time: ~${elapsed}s (simulated)\n`));
  emit('Branches that would be created in a real run:');
  for (const m of missions) {
    emit(`  ${green('✓')} ${m.branch}`);
  }
  emit('');
  emit(`Run ${bold('fleet run --template ' + templateName)} (without --simulate) to execute for real.`);
  emit(`Or run ${bold('fleet plugin install @fleetspark/plugin-drsti-dev-flow')} to add gate enforcement.\n`);

  return output;
}

// ── Command ───────────────────────────────────────────────────────────────────

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run a template locally in sequence — single machine, no extra ships needed')
    .requiredOption('--template <name>', 'Built-in mission template to run')
    .option('--cwd <path>', 'Working directory (default: current directory)')
    .option('--agent <adapter>', 'Override the agent adapter for all missions')
    .option('--simulate', 'Simulate the run without spawning real agents (UAT / preview mode)')
    .action(async (options: { template: string; cwd?: string; agent?: string; simulate?: boolean }) => {
      const workDir = options.cwd ?? process.cwd();

      // Load template
      const template = getTemplate(options.template);
      if (!template) {
        console.error(red(`Unknown template: "${options.template}"`));
        console.error(`Run "fleet command --template list" to see available templates.`);
        process.exit(1);
      }

      // ── Simulate mode ──────────────────────────────────────────────────────
      if (options.simulate) {
        await runSimulate(options.template, {
          agentOverride: options.agent,
          delayMs: 400,
          emit: console.log,
        });
        return;
      }

      // ── Real mode ──────────────────────────────────────────────────────────

      // Load config + plugins
      const config = await loadConfig(workDir);
      const loader = new PluginLoader();
      await loader.load(config.plugins ?? []);
      const plugins = loader.getPlugins();
      const context: FleetContext = { workDir };

      // Sort missions
      const missions = topoSort(template.missions as TemplateMission[]);

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
