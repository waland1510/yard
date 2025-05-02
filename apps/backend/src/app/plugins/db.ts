import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import pg from '@fastify/postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ENV } from '../helpers/env';

export default fp(async function (fastify: FastifyInstance) {
  // Register the PostgreSQL plugin
  fastify.register(pg, {
    connectionString: ENV.DATABASE_URL,
  });

  // Create a Drizzle ORM connection
  const db = drizzle(ENV.DATABASE_URL);

  // Decorate Fastify instance with the Drizzle ORM connection
  fastify.decorate('drizzle', db);
});
