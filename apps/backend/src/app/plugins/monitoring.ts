import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { getCacheMetrics } from '../helpers/cache';

interface PerformanceMetrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    averageResponseTime: number;
  };
  websocket: {
    connections: number;
    messagesReceived: number;
    messagesSent: number;
  };
  cache: {
    game: any;
    player: any;
    aiDecision: any;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  ai: {
    decisionsRequested: number;
    decisionsFromAPI: number;
    decisionsFromLocal: number;
    averageDecisionTime: number;
  };
}

class MetricsCollector {
  private metrics: PerformanceMetrics = {
    requests: {
      total: 0,
      success: 0,
      errors: 0,
      averageResponseTime: 0,
    },
    websocket: {
      connections: 0,
      messagesReceived: 0,
      messagesSent: 0,
    },
    cache: {
      game: {},
      player: {},
      aiDecision: {},
    },
    system: {
      uptime: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    },
    ai: {
      decisionsRequested: 0,
      decisionsFromAPI: 0,
      decisionsFromLocal: 0,
      averageDecisionTime: 0,
    },
  };

  private responseTimes: number[] = [];
  private aiDecisionTimes: number[] = [];
  private startTime = Date.now();

  incrementRequests() {
    this.metrics.requests.total++;
  }

  incrementSuccessfulRequests() {
    this.metrics.requests.success++;
  }

  incrementErrorRequests() {
    this.metrics.requests.errors++;
  }

  recordResponseTime(time: number) {
    this.responseTimes.push(time);
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
    this.updateAverageResponseTime();
  }

  incrementWebSocketConnections() {
    this.metrics.websocket.connections++;
  }

  decrementWebSocketConnections() {
    this.metrics.websocket.connections--;
  }

  incrementWebSocketMessagesReceived() {
    this.metrics.websocket.messagesReceived++;
  }

  incrementWebSocketMessagesSent() {
    this.metrics.websocket.messagesSent++;
  }

  recordAIDecision(source: 'api' | 'local', time: number) {
    this.metrics.ai.decisionsRequested++;
    if (source === 'api') {
      this.metrics.ai.decisionsFromAPI++;
    } else {
      this.metrics.ai.decisionsFromLocal++;
    }
    
    this.aiDecisionTimes.push(time);
    if (this.aiDecisionTimes.length > 100) {
      this.aiDecisionTimes.shift();
    }
    this.updateAverageAIDecisionTime();
  }

  private updateAverageResponseTime() {
    if (this.responseTimes.length > 0) {
      const sum = this.responseTimes.reduce((a, b) => a + b, 0);
      this.metrics.requests.averageResponseTime = sum / this.responseTimes.length;
    }
  }

  private updateAverageAIDecisionTime() {
    if (this.aiDecisionTimes.length > 0) {
      const sum = this.aiDecisionTimes.reduce((a, b) => a + b, 0);
      this.metrics.ai.averageDecisionTime = sum / this.aiDecisionTimes.length;
    }
  }

  getMetrics(): PerformanceMetrics {
    // Update system metrics
    this.metrics.system.uptime = Date.now() - this.startTime;
    this.metrics.system.memoryUsage = process.memoryUsage();
    this.metrics.system.cpuUsage = process.cpuUsage();
    
    // Update cache metrics
    this.metrics.cache = getCacheMetrics();

    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        averageResponseTime: 0,
      },
      websocket: {
        connections: this.metrics.websocket.connections, // Keep current connections
        messagesReceived: 0,
        messagesSent: 0,
      },
      cache: {
        game: {},
        player: {},
        aiDecision: {},
      },
      system: {
        uptime: 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
      ai: {
        decisionsRequested: 0,
        decisionsFromAPI: 0,
        decisionsFromLocal: 0,
        averageDecisionTime: 0,
      },
    };
    this.responseTimes = [];
    this.aiDecisionTimes = [];
    this.startTime = Date.now();
  }
}

const metricsCollector = new MetricsCollector();

/**
 * Monitoring plugin that collects performance metrics and provides endpoints
 */
export default fp(async function (fastify: FastifyInstance) {
  // Add metrics collection hooks
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    metricsCollector.incrementRequests();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = Date.now() - (request.startTime || Date.now());
    metricsCollector.recordResponseTime(responseTime);
    
    if (reply.statusCode < 400) {
      metricsCollector.incrementSuccessfulRequests();
    } else {
      metricsCollector.incrementErrorRequests();
    }
  });

  // Metrics endpoint
  fastify.get('/metrics', async () => {
    return metricsCollector.getMetrics();
  });

  // Health check with basic metrics
  fastify.get('/health', async () => {
    const metrics = metricsCollector.getMetrics();
    const isHealthy = 
      metrics.system.memoryUsage.heapUsed < 1024 * 1024 * 1024 && // Less than 1GB
      metrics.requests.averageResponseTime < 1000; // Less than 1 second

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: metrics.system.uptime,
      version: process.env.npm_package_version || '1.0.0',
      metrics: {
        requests: metrics.requests.total,
        averageResponseTime: Math.round(metrics.requests.averageResponseTime),
        errorRate: metrics.requests.total > 0 
          ? Math.round((metrics.requests.errors / metrics.requests.total) * 100) 
          : 0,
        memoryUsage: Math.round(metrics.system.memoryUsage.heapUsed / 1024 / 1024), // MB
        cacheHitRate: metrics.cache.game.hitRate || 0,
      }
    };
  });

  // Detailed system info endpoint
  fastify.get('/system-info', async () => {
    const metrics = metricsCollector.getMetrics();
    return {
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: {
        ...metrics.system.memoryUsage,
        heapUsedMB: Math.round(metrics.system.memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(metrics.system.memoryUsage.heapTotal / 1024 / 1024),
        externalMB: Math.round(metrics.system.memoryUsage.external / 1024 / 1024),
      },
      uptime: {
        process: Math.round(process.uptime()),
        system: Math.round(metrics.system.uptime / 1000),
      },
      environment: process.env.NODE_ENV || 'development',
    };
  });

  // Reset metrics endpoint (for development/testing)
  if (process.env.NODE_ENV !== 'production') {
    fastify.post('/metrics/reset', async () => {
      metricsCollector.reset();
      return { message: 'Metrics reset successfully' };
    });
  }

  // Decorate fastify instance with metrics collector
  fastify.decorate('metrics', metricsCollector);
});

// Export the metrics collector for use in other parts of the application
export { metricsCollector };

// Types for TypeScript
declare module 'fastify' {
  interface FastifyInstance {
    metrics: MetricsCollector;
  }
  
  interface FastifyRequest {
    startTime?: number;
  }
}

// Utility functions for external use
export const recordAIDecision = (source: 'api' | 'local', time: number) => {
  metricsCollector.recordAIDecision(source, time);
};

export const incrementWebSocketConnection = () => {
  metricsCollector.incrementWebSocketConnections();
};

export const decrementWebSocketConnection = () => {
  metricsCollector.decrementWebSocketConnections();
};

export const incrementWebSocketMessage = (direction: 'received' | 'sent') => {
  if (direction === 'received') {
    metricsCollector.incrementWebSocketMessagesReceived();
  } else {
    metricsCollector.incrementWebSocketMessagesSent();
  }
};
