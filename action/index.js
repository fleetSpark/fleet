const { execSync } = require('child_process');
const core = require('@actions/core');

async function run() {
  try {
    const command = core.getInput('command', { required: true });
    const plan = core.getInput('plan');
    const template = core.getInput('template');
    const agent = core.getInput('agent') || 'claude-code';
    const repo = core.getInput('repo') || `https://github.com/${process.env.GITHUB_REPOSITORY}.git`;

    core.info('Installing fleetspark...');
    execSync('npm install -g fleetspark', { stdio: 'inherit' });

    let cmd = '';
    switch (command) {
      case 'init':
        cmd = 'fleetspark init';
        break;
      case 'plan':
        if (template) {
          cmd = `fleetspark command --template ${template}`;
        } else if (plan) {
          cmd = `fleetspark command --plan "${plan}"`;
        } else {
          core.setFailed('Either "plan" or "template" input is required for plan command');
          return;
        }
        break;
      case 'ship':
        cmd = `fleetspark ship --join ${repo}`;
        break;
      case 'status':
        cmd = 'fleetspark status --json';
        break;
      case 'report':
        cmd = 'fleetspark report';
        break;
      default:
        core.setFailed(`Unknown command: ${command}`);
        return;
    }

    core.info(`Running: ${cmd}`);
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    core.info(output);
    core.setOutput('result', output);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
