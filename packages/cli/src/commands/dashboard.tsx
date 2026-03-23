import type { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { App } from '../dashboard/App.js';

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .alias('dash')
    .description('Interactive mission board (TUI)')
    .action(async () => {
      const cwd = process.cwd();
      const { waitUntilExit } = render(React.createElement(App, { cwd }));
      await waitUntilExit();
    });
}
