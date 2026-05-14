import type { Command } from 'commander';

interface DemoMission {
  id: string;
  branch: string;
  ship: string;
  agent: string;
  depends: string[];
  steps: string[];
}

const DEMO_MISSIONS: DemoMission[] = [
  {
    id: 'M1',
    branch: 'feat/oauth-login',
    ship: 'ship-alpha',
    agent: 'claude-code',
    depends: [],
    steps: [
      'Scaffold OAuth route handlers',
      'Implement token exchange flow',
      'Add session middleware',
    ],
  },
  {
    id: 'M2',
    branch: 'feat/rate-limiter',
    ship: 'ship-bravo',
    agent: 'codex',
    depends: [],
    steps: [
      'Create sliding-window limiter',
      'Add Redis backing store',
      'Wire up middleware',
    ],
  },
  {
    id: 'M3',
    branch: 'feat/api-docs',
    ship: 'ship-charlie',
    agent: 'aider',
    depends: [],
    steps: [
      'Extract OpenAPI spec from routes',
      'Generate markdown reference',
      'Add examples for each endpoint',
    ],
  },
  {
    id: 'M4',
    branch: 'feat/unit-tests',
    ship: 'ship-delta',
    agent: 'gemini',
    depends: ['M1'],
    steps: [
      'Wait for M1 (oauth-login) to merge',
      'Generate test stubs for auth module',
      'Implement integration test suite',
    ],
  },
];

type LogFn = (msg: string) => void;

function delay(ms: number, multiplier: number): Promise<void> {
  const actual = ms * multiplier;
  if (actual <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, actual));
}

/** Group missions into parallel waves by topological order. */
function buildWaves(missions: DemoMission[]): DemoMission[][] {
  const remaining = [...missions];
  const done = new Set<string>();
  const waves: DemoMission[][] = [];

  while (remaining.length > 0) {
    const wave = remaining.filter((m) => m.depends.every((d) => done.has(d)));
    if (wave.length === 0) break; // cycle guard
    waves.push(wave);
    for (const m of wave) {
      done.add(m.id);
      remaining.splice(remaining.indexOf(m), 1);
    }
  }
  return waves;
}

export function runBenchmark(minutesPerStep = 3, log: LogFn = console.log): void {
  const waves = buildWaves(DEMO_MISSIONS);

  // Sequential: every mission runs one after another
  const totalSteps = DEMO_MISSIONS.reduce((s, m) => s + m.steps.length, 0);
  const sequentialMin = totalSteps * minutesPerStep;

  // Parallel: each wave's duration = longest mission in that wave
  const parallelMin = waves.reduce((sum, wave) => {
    const longest = Math.max(...wave.map((m) => m.steps.length));
    return sum + longest * minutesPerStep;
  }, 0);

  const speedup = (sequentialMin / parallelMin).toFixed(1);
  const savedMin = sequentialMin - parallelMin;

  log('');
  log('=== FleetSpark Benchmark ===');
  log(`Assumption: ${minutesPerStep} min per agent step  (override: --step-minutes <n>)`);
  log('');
  log(`Missions: ${DEMO_MISSIONS.length}  Ships: ${waves.length > 1 ? waves[0].length : 1}  Waves: ${waves.length}`);
  log('');
  log('Sequential (single machine):');
  log(`  ${DEMO_MISSIONS.map((m) => `${m.id}(${m.steps.length})`).join(' → ')} = ${sequentialMin} min`);
  log('');
  log('Fleet parallel:');
  waves.forEach((wave, i) => {
    const maxSteps = Math.max(...wave.map((m) => m.steps.length));
    const ids = wave.map((m) => m.id).join(' ‖ ');
    log(`  Wave ${i + 1}: ${ids}  →  ${maxSteps} steps × ${minutesPerStep} min = ${maxSteps * minutesPerStep} min`);
  });
  log(`  Total: ${parallelMin} min`);
  log('');
  log(`Speedup: ${speedup}x   Wall time saved: ${savedMin} min`);
  log('');
  log('Reproduce this:');
  log('  npx fleetspark init');
  log('  npx fleetspark ship --join git@github.com:you/your-repo.git');
  log('  npx fleetspark ship --join git@github.com:you/your-repo.git');
  log('  npx fleetspark ship --join git@github.com:you/your-repo.git');
  log('  npx fleetspark command --template test-coverage');
  log('');
}

export async function runDemo(
  log: LogFn = console.log,
  delayMultiplier: number = 1,
): Promise<string[]> {
  const output: string[] = [];

  function emit(msg: string): void {
    output.push(msg);
    log(msg);
  }

  // --- Banner ---
  emit('');
  emit('=== FleetSpark Demo ===');
  emit('Simulating a 4-mission fleet run...');
  emit('');

  // --- Planning phase ---
  emit('[commander] Planning missions...');
  await delay(400, delayMultiplier);

  for (const m of DEMO_MISSIONS) {
    const deps = m.depends.length > 0 ? ` (depends: ${m.depends.join(', ')})` : '';
    emit(`  + ${m.id}: ${m.branch} — ${m.agent}${deps}`);
    await delay(150, delayMultiplier);
  }
  emit('');

  // --- Ship assignment phase ---
  emit('[commander] Assigning ships...');
  await delay(300, delayMultiplier);

  for (const m of DEMO_MISSIONS) {
    emit(`  ${m.id} -> ${m.ship} (${m.agent})`);
    await delay(100, delayMultiplier);
  }
  emit('');

  // --- Progress phase: run M1, M2, M3 in parallel, then M4 ---
  emit('[fleet] Missions in progress...');
  emit('');

  // Wave 1: M1, M2, M3 (no dependencies)
  const wave1 = DEMO_MISSIONS.filter((m) => m.depends.length === 0);
  for (const m of wave1) {
    emit(`[${m.ship}] Starting ${m.id} (${m.branch})...`);
    await delay(200, delayMultiplier);

    for (const step of m.steps) {
      emit(`  [${m.id}] ${step}`);
      await delay(250, delayMultiplier);
    }
    emit(`  [${m.id}] Done.`);
    await delay(100, delayMultiplier);
  }

  emit('');

  // Wave 2: M4 (depends on M1)
  const wave2 = DEMO_MISSIONS.filter((m) => m.depends.length > 0);
  for (const m of wave2) {
    emit(`[${m.ship}] Dependency ${m.depends.join(', ')} merged. Starting ${m.id} (${m.branch})...`);
    await delay(200, delayMultiplier);

    for (const step of m.steps) {
      emit(`  [${m.id}] ${step}`);
      await delay(250, delayMultiplier);
    }
    emit(`  [${m.id}] Done.`);
    await delay(100, delayMultiplier);
  }

  emit('');

  // --- Completion ---
  emit('[commander] All missions complete.');
  emit('');
  emit('Summary:');
  for (const m of DEMO_MISSIONS) {
    emit(`  ${m.id} ${m.branch} — ${m.agent} on ${m.ship} — merged`);
  }
  emit('');

  // --- Next steps ---
  emit('Next steps:');
  emit('  fleetspark init          Initialize Fleet in your repo');
  emit('  fleetspark command       Plan missions from a goal');
  emit('  fleetspark ship          Launch ships to execute missions');
  emit('');

  return output;
}

export function registerDemoCommand(program: Command): void {
  program
    .command('demo')
    .description('Run a simulated fleet demo to see FleetSpark in action')
    .option('--benchmark', 'Print parallel vs sequential speedup analysis')
    .option('--step-minutes <n>', 'Minutes per agent step used in benchmark (default: 3)', '3')
    .action(async (opts: { benchmark?: boolean; stepMinutes?: string }) => {
      if (opts.benchmark) {
        runBenchmark(Number(opts.stepMinutes ?? 3));
      } else {
        await runDemo(console.log, 1);
      }
    });
}
