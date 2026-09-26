import { FastifyInstance, FastifyRequest } from 'fastify';
import { saveIpInfo } from '../helpers/db-transactions';
import { ENV } from '../helpers/env';

interface IpInfoLookup {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  postal?: string;
  timezone?: string;
}

const LOOKUP_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; info: IpInfoLookup }>();

const PRIVATE_IP =
  /^(::1|::ffff:127\.|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:10\.|::ffff:192\.168\.|fc|fd|fe80)/i;

// A loopback/LAN caller is on the server's own network, so looking up the server's
// public IP (no IP in the URL) gives the right city in local development.
function lookupKey(request: FastifyRequest): string {
  return PRIVATE_IP.test(request.ip) ? '' : request.ip;
}

async function lookup(ip: string): Promise<IpInfoLookup | null> {
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.info;
  const url = new URL(`https://ipinfo.io/${ip ? `${encodeURIComponent(ip)}/` : ''}json`);
  if (ENV.IPINFO_TOKEN) url.searchParams.set('token', ENV.IPINFO_TOKEN);
  const res = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
  if (!res.ok) return null;
  const info = (await res.json()) as IpInfoLookup;
  cache.set(ip, { at: Date.now(), info });
  return info;
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/geo', async (request, reply) => {
    try {
      const info = await lookup(lookupKey(request));
      if (!info) return reply.code(204).send();
      return { city: info.city, region: info.region, country: info.country };
    } catch (error) {
      request.log.warn({ err: error }, 'geo: lookup failed');
      return reply.code(204).send();
    }
  });

  fastify.post<{ Body: { username: string } }>(
    '/geo',
    {
      schema: {
        body: {
          type: 'object',
          properties: { username: { type: 'string', minLength: 1, maxLength: 45 } },
          required: ['username'],
        },
      },
    },
    async (request, reply) => {
      try {
        const info = await lookup(lookupKey(request));
        if (!info?.loc) return reply.code(204).send();
        const saved = await saveIpInfo({
          username: request.body.username,
          city: info.city ?? '',
          region: info.region ?? '',
          country: info.country ?? '',
          loc: info.loc,
          org: info.org ?? '',
          postal: info.postal ?? '',
          timezone: info.timezone ?? '',
        });
        return reply.code(saved ? 201 : 204).send();
      } catch (error) {
        request.log.warn({ err: error }, 'geo: failed to record visit');
        return reply.code(204).send();
      }
    }
  );
}
