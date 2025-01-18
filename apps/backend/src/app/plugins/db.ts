import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import pg from '@fastify/postgres';

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(pg, {
    connectionString:
      process.env.NODE_ENV === 'development'
        ? 'postgresql://postgres:postgres@localhost/yard'
        : 'postgresql://yard_user:mMVVmHTBUjmchR37wUgNpWYn23dxKnbj@dpg-cu48r2rqf0us73fu5r50-a/yard',
  });
});
