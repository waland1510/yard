import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import pg from '@fastify/postgres';

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(pg, {
    connectionString: 'postgresql://yard_user:mMVVmHTBUjmchR37wUgNpWYn23dxKnbj@dpg-cu48r2rqf0us73fu5r50-a.oregon-postgres.render.com/yard',
  });
});
