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

const program = new Command();

program
  .name('fleet')
  .description('Steroids for AI coding — multi-machine orchestration for coding agents')
  .version('1.0.0');

registerInitCommand(program);
registerStatusCommand(program);
registerCommandCommand(program);
registerShipCommand(program);
registerAssignCommand(program);
registerBriefCommand(program);
registerLogsCommand(program);
registerDashboardCommand(program);

program.parse();
