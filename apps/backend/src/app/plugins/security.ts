import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { securityHeaders, rateLimitConfig } from '../helpers/validation-schemas';

/**
 * Security plugin that adds rate limiting, security headers, and other security measures
 */
export default fp(async function (fastify: FastifyInstance) {
  // Register helmet for security headers
  await fastify.register(helmet, securityHeaders);

  // Register rate limiting
  await fastify.register(rateLimit, {
    max: rateLimitConfig.global.max,
    timeWindow: rateLimitConfig.global.timeWindow,
    errorResponseBuilder: function (request, context) {
      return {
        code: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${Math.round(context.ttl / 1000)} seconds`,
        date: Date.now(),
        expiresIn: Math.round(context.ttl / 1000)
      };
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    },
    // Skip rate limiting for health checks
    skip: function (request) {
      return request.url === '/health' || request.url === '/';
    }
  });

  // Add custom security middleware
  fastify.addHook('onRequest', async (request, reply) => {
    // Add request ID for tracing
    request.id = request.id || generateRequestId();
    
    // Log security-relevant requests
    if (request.method !== 'GET' || request.url.includes('/api/')) {
      fastify.log.info({
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }, 'Security audit log');
    }

    // Validate content type for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        reply.code(400).send({
          error: 'Bad Request',
          message: 'Content-Type must be application/json'
        });
        return;
      }
    }

    // Check for suspicious patterns in URLs
    const suspiciousPatterns = [
      /\.\./,  // Path traversal
      /<script/i,  // XSS attempts
      /union.*select/i,  // SQL injection attempts
      /javascript:/i,  // JavaScript protocol
      /data:.*base64/i  // Data URLs with base64
    ];

    const url = decodeURIComponent(request.url);
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        fastify.log.warn({
          requestId: request.id,
          ip: request.ip,
          url: request.url,
          pattern: pattern.toString()
        }, 'Suspicious request detected');
        
        reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid request format'
        });
        return;
      }
    }
  });

  // Add response security headers
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Remove server information
    reply.removeHeader('x-powered-by');
    
    // Add custom security headers
    reply.header('X-Request-ID', request.id);
    reply.header('X-API-Version', '1.0');
    
    return payload;
  });

  // Error handling hook for security
  fastify.setErrorHandler(async (error, request, reply) => {
    // Log security-related errors
    fastify.log.error({
      requestId: request.id,
      error: error.message,
      stack: error.stack,
      ip: request.ip,
      url: request.url,
      method: request.method
    }, 'Security error occurred');

    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (error.statusCode === 429) {
      // Rate limit error
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: error.retryAfter || 60
      });
    } else if (error.validation) {
      // Validation error
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: isDevelopment ? error.validation : undefined
      });
    } else if (error.statusCode >= 400 && error.statusCode < 500) {
      // Client errors
      reply.code(error.statusCode).send({
        error: error.name || 'Client Error',
        message: error.message || 'Bad request'
      });
    } else {
      // Server errors - don't expose details
      reply.code(500).send({
        error: 'Internal Server Error',
        message: isDevelopment ? error.message : 'An unexpected error occurred',
        requestId: request.id
      });
    }
  });

  // Health check endpoint (bypasses rate limiting)
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    };
  });
});

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export types for use in other files
export interface SecurityContext {
  requestId: string;
  ip: string;
  userAgent?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}
