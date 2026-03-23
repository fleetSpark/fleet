import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { GitPoller } from './poller.js';
import type { StateSnapshot } from './poller.js';
import { StateCache } from './state.js';
import { apiRoutes } from './routes/api.js';
import { sseRoutes } from './routes/sse.js';
import { staticRoutes } from './routes/static.js';

export interface ServerOptions {
  cwd: string;
  pollInterval?: number;
  host?: string;
  port?: number;
}

export interface ServerInstance {
  app: FastifyInstance;
  poller: GitPoller;
  cache: StateCache;
}

export function createServer(options: ServerOptions): ServerInstance {
  const { cwd, pollInterval = 15_000 } = options;

  const app = Fastify({ logger: false });
  const poller = new GitPoller(cwd, pollInterval);
  const cache = new StateCache();

  // CORS headers
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
  });

  // Wire poller to cache
  poller.on('update', (snapshot: StateSnapshot) => {
    cache.update(snapshot);
  });

  // Register route plugins
  app.register(apiRoutes, { cache });
  app.register(sseRoutes, { cache });
  app.register(staticRoutes);

  return { app, poller, cache };
}
