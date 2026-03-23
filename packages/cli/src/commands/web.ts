import type { Command } from 'commander';
import { networkInterfaces } from 'node:os';
import { exec } from 'node:child_process';

function getLanAddress(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const interfaces = nets[name];
    if (!interfaces) continue;
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

function openBrowser(url: string): void {
  const { platform } = process;
  const cmd =
    platform === 'win32' ? `start "" "${url}"`
    : platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      // Silently ignore — user can open manually
    }
  });
}

export function registerWebCommand(program: Command): void {
  program
    .command('web')
    .description('Start the Fleet web dashboard')
    .option('-p, --port <port>', 'HTTP port', '4000')
    .option('-H, --host <host>', 'Bind address', '0.0.0.0')
    .option('--poll <ms>', 'Poll interval in milliseconds', '15000')
    .option('--no-open', 'Do not open browser automatically')
    .action(async (options) => {
      const { createServer } = await import('@fleetspark/web-dashboard');

      const port = parseInt(options.port, 10);
      const host = options.host as string;
      const pollInterval = parseInt(options.poll, 10);

      const { app, poller } = createServer({
        cwd: process.cwd(),
        pollInterval,
        host,
        port,
      });

      poller.start();

      try {
        await app.listen({ port, host });
      } catch (err) {
        console.error('Failed to start web dashboard:', err);
        process.exit(1);
      }

      const localUrl = `http://localhost:${port}`;
      const lanIp = getLanAddress();

      console.log('');
      console.log('  \u26A1 Fleet Web Dashboard');
      console.log('');
      console.log(`  Local:   ${localUrl}`);
      if (lanIp) {
        console.log(`  Network: http://${lanIp}:${port}`);
      }
      console.log('');
      console.log('  Press Ctrl+C to stop');
      console.log('');

      if (options.open !== false) {
        openBrowser(localUrl);
      }

      // Graceful shutdown
      const shutdown = (): void => {
        console.log('\nShutting down...');
        poller.stop();
        void app.close().then(() => process.exit(0));
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}
