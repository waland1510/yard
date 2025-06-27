import { z } from 'zod';
import { RoleType } from '@yard/shared-utils';

// Game validation schemas
export const createGameSchema = z.object({
  aiRoles: z.array(z.string()).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
});

export const updateGameSchema = z.object({
  status: z.enum(['active', 'finished']).optional(),
  currentTurn: z.string().optional(),
  isDoubleMove: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
});

export const gameChannelSchema = z.object({
  channel: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Channel must contain only alphanumeric characters, hyphens, and underscores"
  }),
});

// Player validation schemas
export const updatePlayerSchema = z.object({
  username: z.string().min(1).max(50).optional(),
  position: z.number().int().min(1).max(200).optional(),
  taxiTickets: z.number().int().min(0).max(50).optional(),
  busTickets: z.number().int().min(0).max(50).optional(),
  undergroundTickets: z.number().int().min(0).max(50).optional(),
  secretTickets: z.number().int().min(0).max(10).optional(),
  doubleTickets: z.number().int().min(0).max(5).optional(),
  isAI: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
});

export const playerIdSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID must be a valid number").transform(Number),
});

// Move validation schemas
export const moveSchema = z.object({
  gameId: z.number().int().positive(),
  role: z.enum(['culprit', 'detective1', 'detective2', 'detective3', 'detective4', 'detective5'] as const),
  type: z.enum(['taxi', 'bus', 'underground'] as const),
  position: z.number().int().min(1).max(200),
  secret: z.boolean().default(false),
  double: z.boolean().default(false),
});

// WebSocket message validation schemas
export const websocketMessageSchema = z.object({
  type: z.enum(['startGame', 'joinGame', 'makeMove', 'updateGameState', 'impersonate', 'endGame']),
  channel: z.string().min(1).max(50),
  data: z.record(z.any()),
});

// IP Info validation schema
export const ipInfoSchema = z.object({
  username: z.string().min(1).max(50),
  ip: z.string().ip().optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
});

// User validation schemas
export const createUserSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Username must contain only alphanumeric characters, hyphens, and underscores"
  }),
  email: z.string().email().max(255),
});

export const userIdSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID must be a valid number").transform(Number),
});

// Validation helper functions
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
    throw new Error(`Validation failed: ${errors}`);
  }
  return result.data;
}

export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown) => validateSchema(schema, data);
}

// Rate limiting schemas
export const rateLimitConfig = {
  global: {
    max: 100,
    timeWindow: '1 minute'
  },
  createGame: {
    max: 5,
    timeWindow: '1 minute'
  },
  makeMove: {
    max: 30,
    timeWindow: '1 minute'
  },
  websocket: {
    max: 60,
    timeWindow: '1 minute'
  }
};

// Security headers configuration
export const securityHeaders = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true,
};
