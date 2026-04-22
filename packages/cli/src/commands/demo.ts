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
    .action(async () => {
      await runDemo(console.log, 1);
    });
}
