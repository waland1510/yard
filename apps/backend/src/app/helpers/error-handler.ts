import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  GAME_LOGIC_ERROR = 'GAME_LOGIC_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, ErrorCode.NOT_FOUND, true, { resource, identifier });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 500, ErrorCode.DATABASE_ERROR, true, { 
      originalError: originalError?.message 
    });
  }
}

export class ExternalAPIError extends AppError {
  constructor(service: string, message: string, statusCode?: number) {
    super(`External API error from ${service}: ${message}`, 502, ErrorCode.EXTERNAL_API_ERROR, true, {
      service,
      externalStatusCode: statusCode
    });
  }
}

export class GameLogicError extends AppError {
  constructor(message: string, gameId?: number, playerId?: number) {
    super(message, 400, ErrorCode.GAME_LOGIC_ERROR, true, { gameId, playerId });
  }
}

export class AIServiceError extends AppError {
  constructor(message: string, aiService?: string) {
    super(message, 503, ErrorCode.AI_SERVICE_ERROR, true, { aiService });
  }
}

export function handleError(
  error: Error | FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const requestId = request.id || 'unknown';

  // Log the error
  const logContext = {
    requestId,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    error: {
      name: error.name,
      message: error.message,
      stack: isDevelopment ? error.stack : undefined,
      ...(error instanceof AppError && { 
        code: error.code,
        context: error.context 
      })
    }
  };

  if (error instanceof AppError && error.isOperational) {
    request.log.warn(logContext, 'Operational error occurred');
  } else {
    request.log.error(logContext, 'Unexpected error occurred');
  }

  // Determine response based on error type
  let statusCode = 500;
  let errorCode = ErrorCode.INTERNAL_ERROR;
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = isDevelopment ? error.context : undefined;
  } else if ('statusCode' in error && typeof error.statusCode === 'number') {
    statusCode = error.statusCode;
    message = error.message;
  } else if ('validation' in error) {
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_ERROR;
    message = 'Validation failed';
    details = isDevelopment ? error.validation : undefined;
  }

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      ...(details && { details })
    }
  };

  reply.code(statusCode).send(errorResponse);
}

export function asyncHandler(
  fn: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await fn(request, reply);
    } catch (error) {
      handleError(error as Error, request, reply);
    }
  };
}

export function wrapDatabaseOperation<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  return operation().catch((error) => {
    const message = context 
      ? `Database operation failed: ${context}`
      : 'Database operation failed';
    throw new DatabaseError(message, error);
  });
}

export function wrapExternalAPICall<T>(
  apiCall: () => Promise<T>,
  serviceName: string
): Promise<T> {
  return apiCall().catch((error) => {
    let message = 'API call failed';
    let statusCode: number | undefined;

    if (error.response) {
      statusCode = error.response.status;
      message = error.response.data?.message || error.message;
    } else if (error.request) {
      message = 'No response received from API';
    } else {
      message = error.message;
    }

    throw new ExternalAPIError(serviceName, message, statusCode);
  });
}

// Utility function to check if error is operational
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

// Graceful shutdown handler
export function setupGracefulShutdown(server: any, logger: any): void {
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled rejection');
    process.exit(1);
  });
}
