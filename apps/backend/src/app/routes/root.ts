import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async function () {
    return { message: 'Hello API' };
  });

  // CORS debugging endpoint
  fastify.get('/cors-test', async function (request, reply) {
    const origin = request.headers.origin;
    const userAgent = request.headers['user-agent'];

    return {
      message: 'CORS test endpoint',
      origin: origin || 'No origin header',
      userAgent: userAgent || 'No user agent',
      timestamp: new Date().toISOString(),
      headers: request.headers,
    };
  });

  // Health check that includes CORS info
  fastify.get('/health-cors', async function (request, reply) {
    const origin = request.headers.origin;

    return {
      status: 'healthy',
      cors: {
        origin: origin || 'No origin header',
        allowed: true, // If this endpoint responds, CORS is working
      },
      timestamp: new Date().toISOString(),
    };
  });
}
