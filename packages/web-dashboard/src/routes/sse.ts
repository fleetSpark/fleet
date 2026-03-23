import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { StateCache } from '../state.js';

interface SsePluginOptions extends FastifyPluginOptions {
  cache: StateCache;
}

export async function sseRoutes(
  app: FastifyInstance,
  opts: SsePluginOptions,
): Promise<void> {
  const { cache } = opts;

  app.get('/events', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send immediate snapshot if available
    const latest = cache.getLatest();
    if (latest) {
      reply.raw.write(`data: ${JSON.stringify(latest)}\n\n`);
    }

    // Subscribe to updates
    const unsubscribe = cache.subscribe(reply);

    // Keepalive ping every 30s
    const pingTimer = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(pingTimer);
        unsubscribe();
      }
    }, 30_000);

    // Cleanup on disconnect
    request.raw.on('close', () => {
      clearInterval(pingTimer);
      unsubscribe();
    });

    // Prevent Fastify from sending a response — we're streaming
    await reply.hijack();
  });
}
