import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { analyzeRisk, meterUsage, priceUsage } from '@fleetspark/core';
import type { StateCache } from '../state.js';

interface ApiPluginOptions extends FastifyPluginOptions {
  cache: StateCache;
}

export async function apiRoutes(
  app: FastifyInstance,
  opts: ApiPluginOptions,
): Promise<void> {
  const { cache } = opts;

  app.get('/api/state', async (_request, reply) => {
    const latest = cache.getLatest();
    if (!latest) {
      return reply.code(503).send({ error: 'Fleet state not yet available' });
    }
    return reply.send(latest);
  });

  app.get('/api/risk', async (_request, reply) => {
    const snapshot = cache.getLatestSnapshot();
    if (!snapshot) {
      return reply.code(503).send({ error: 'Fleet state not yet available' });
    }
    const report = analyzeRisk(snapshot.manifest);
    return reply.send(report);
  });

  app.get('/api/usage', async (_request, reply) => {
    const snapshot = cache.getLatestSnapshot();
    if (!snapshot) {
      return reply.code(503).send({ error: 'Fleet state not yet available' });
    }
    const usage = meterUsage(snapshot.manifest);
    return reply.send({ usage, priced: priceUsage(usage) });
  });

  app.get<{ Params: { missionId: string } }>(
    '/api/mission/:missionId/log',
    async (request, reply) => {
      const { missionId } = request.params;
      const snapshot = cache.getLatestSnapshot();

      if (!snapshot) {
        return reply.code(503).send({ error: 'Fleet state not yet available' });
      }

      const log = snapshot.logs.get(missionId);
      if (!log) {
        return reply.code(404).send({ error: `No log found for mission ${missionId}` });
      }

      return reply.send({
        ...log,
        heartbeat: {
          lastPush: log.heartbeat.lastPush.toISOString(),
          pushInterval: log.heartbeat.pushInterval,
        },
      });
    },
  );
}
