import { FastifyInstance } from 'fastify';
import { pingDatabase } from '../helpers/db-operations';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async function () {
    return { message: 'Hello API' };
  });

  fastify.get('/health', async function (request, reply) {
    try {
      await pingDatabase();
      return { status: 'ok', database: 'ok', uptimeSeconds: Math.round(process.uptime()) };
    } catch (error) {
      request.log.error({ err: error }, 'health: database unreachable');
      return reply.code(503).send({ status: 'degraded', database: 'unreachable' });
    }
  });
}
