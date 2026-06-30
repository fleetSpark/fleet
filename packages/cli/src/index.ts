#!/usr/bin/env node
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerStatusCommand } from './commands/status.js';
import { registerCommandCommand } from './commands/command.js';
import { registerShipCommand } from './commands/ship.js';
import { registerAssignCommand } from './commands/assign.js';
import { registerBriefCommand } from './commands/brief.js';
import { registerLogsCommand } from './commands/logs.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { registerWebCommand } from './commands/web.js';
import { registerDemoCommand } from './commands/demo.js';
import { registerReportCommand } from './commands/report.js';
import { registerPluginCommand } from './commands/plugin.js';
import { registerRunCommand } from './commands/run.js';
import { registerOutcomesCommand } from './commands/outcomes.js';
import { registerHeartbeatCommand } from './commands/heartbeat.js';
import { registerBenchmarksCommand } from './commands/benchmarks.js';
import { registerReplayCommand } from './commands/replay.js';
import { registerMarketplaceCommand } from './commands/marketplace.js';

const program = new Command();

program
  .name('fleet')
  .description('Steroids for AI coding — multi-machine orchestration for coding agents')
  .version('1.1.9');

registerInitCommand(program);
registerStatusCommand(program);
registerCommandCommand(program);
registerShipCommand(program);
registerAssignCommand(program);
registerBriefCommand(program);
registerLogsCommand(program);
registerDashboardCommand(program);
registerWebCommand(program);
registerDemoCommand(program);
registerReportCommand(program);
registerPluginCommand(program);
registerRunCommand(program);
registerOutcomesCommand(program);
registerHeartbeatCommand(program);
registerBenchmarksCommand(program);
registerReplayCommand(program);
registerMarketplaceCommand(program);

program.parse();
