import { runQuery } from '@yard/shared-utils';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const addUser = `INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *;`;
const getUserById = 'SELECT * from users   WHERE id = $1';

export default async function (fastify: FastifyInstance) {
  fastify.post(
    '/api/users',
    async (
      request: FastifyRequest<{ Body: { username: string; email: string } }>
    ) => {
      const { username, email } = request.body;

      const { rows } = await runQuery(fastify.pg, addUser, [username, email]);
      return rows;
    }
  );
    fastify.get(
      '/api/users/:id',
      async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const { id } = request.params;
        const { rows } = await runQuery(fastify.pg, getUserById, [id]);
        return rows;
        
      }
    );
}
