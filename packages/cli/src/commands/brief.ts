import type { Command } from 'commander';
import { RealGitOps, BriefGenerator, loadConfig } from '@fleetspark/core';

export function registerBriefCommand(program: Command): void {
  program
    .command('brief')
    .description('Generate FLEET_CONTEXT.md for ships')
    .option('--generate', 'Generate the brief from codebase analysis')
    .option('--llm', 'Use LLM for enhanced architecture narrative')
    .action(async (options) => {
      if (!options.generate) {
        console.error('Usage: fleet brief --generate [--llm]');
        process.exit(1);
      }

      const cwd = process.cwd();
      const git = new RealGitOps(cwd);
      const config = await loadConfig(cwd);

      const currentBranch = await git.getCurrentBranch();
      if (currentBranch !== 'main') {
        console.error('fleet brief --generate must be run from the main branch');
        process.exit(1);
      }

      const useLlm = options.llm || config.brief.mode === 'llm';
      const generator = new BriefGenerator(git);

      console.log(`Generating FLEET_CONTEXT.md (${useLlm ? 'LLM-enhanced' : 'static'} mode)...`);

      const content = await generator.generate(cwd, { llm: useLlm });

      const { writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      await writeFile(join(cwd, 'FLEET_CONTEXT.md'), content, 'utf-8');
      await git.addAndCommit(['FLEET_CONTEXT.md'], 'fleet: generate FLEET_CONTEXT.md');

      const { execFile: execFileCb } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFile = promisify(execFileCb);
      await execFile('git', ['push', 'origin', 'main'], { cwd });

      console.log('FLEET_CONTEXT.md generated and pushed to main.');
    });
}
