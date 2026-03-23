import type { FastifyInstance } from 'fastify';
import { HTML } from '../public/index.html.js';

export async function staticRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request, reply) => {
    return reply.type('text/html').send(HTML);
  });
}
