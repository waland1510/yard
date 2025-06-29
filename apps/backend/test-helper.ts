import { FastifyInstance } from 'fastify';
import { fastify } from 'fastify';
import { app } from './src/app/app';

// Test database configuration
const testConfig = {
  logger: false, // Disable logging during tests
  pluginTimeout: 10000,
};

export async function build(): Promise<FastifyInstance> {
  const server = fastify(testConfig);
  
  // Register the main app
  await server.register(app);
  
  // Wait for the server to be ready
  await server.ready();
  
  return server;
}

// Mock database operations for testing
export const mockDbOperations = {
  hasActiveGame: jest.fn(),
  updateGame: jest.fn(),
  createGame: jest.fn(),
  updatePlayer: jest.fn(),
  addMove: jest.fn(),
  saveIpInfo: jest.fn(),
};

// Test data factories
export const createTestGame = (overrides = {}) => ({
  id: 1,
  channel: 'test-channel',
  players: [
    {
      id: 1,
      role: 'culprit',
      position: 45,
      previousPosition: 45,
      taxiTickets: 4,
      busTickets: 3,
      undergroundTickets: 3,
      secretTickets: 5,
      doubleTickets: 2,
      isAI: false,
    },
    {
      id: 2,
      role: 'detective1',
      position: 26,
      previousPosition: 26,
      taxiTickets: 10,
      busTickets: 8,
      undergroundTickets: 4,
      isAI: false,
    },
  ],
  currentTurn: 'culprit',
  moves: [],
  status: 'active',
  isDoubleMove: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestPlayer = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  role: 'detective1',
  position: 26,
  previousPosition: 26,
  taxiTickets: 10,
  busTickets: 8,
  undergroundTickets: 4,
  isAI: false,
  ...overrides,
});

export const createTestMove = (overrides = {}) => ({
  gameId: 1,
  role: 'culprit',
  type: 'taxi',
  position: 1,
  secret: false,
  double: false,
  timestamp: new Date(),
  ...overrides,
});

// Test utilities
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const expectValidationError = (response: any, field?: string) => {
  expect(response.statusCode).toBe(400);
  const body = JSON.parse(response.body);
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('VALIDATION_ERROR');
  if (field) {
    expect(body.error.message).toContain(field);
  }
};

export const expectNotFoundError = (response: any, resource?: string) => {
  expect(response.statusCode).toBe(404);
  const body = JSON.parse(response.body);
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('NOT_FOUND');
  if (resource) {
    expect(body.error.message).toContain(resource);
  }
};

export const expectDatabaseError = (response: any) => {
  expect(response.statusCode).toBe(500);
  const body = JSON.parse(response.body);
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('DATABASE_ERROR');
};

// Mock WebSocket for testing
export class MockWebSocket {
  public readyState = 1; // OPEN
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  
  private listeners: { [key: string]: ((event: any) => void)[] } = {};

  constructor(public url: string) {}

  send(data: string) {
    // Simulate message sending
    console.log('Mock WebSocket send:', data);
  }

  close(code?: number, reason?: string) {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.listeners[type]) {
      const index = this.listeners[type].indexOf(listener);
      if (index > -1) {
        this.listeners[type].splice(index, 1);
      }
    }
  }

  dispatchEvent(event: Event): boolean {
    const type = event.type;
    if (this.listeners[type]) {
      this.listeners[type].forEach(listener => listener(event));
    }
    return true;
  }

  // Helper methods for testing
  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Environment setup for tests
export const setupTestEnvironment = () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/yard_test';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.FRONTEND_URL = 'http://localhost:4200';
  
  // Mock global WebSocket
  (global as any).WebSocket = MockWebSocket;
  
  // Mock console methods to reduce noise in tests
  const originalConsole = { ...console };
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  
  return () => {
    // Restore console
    Object.assign(console, originalConsole);
  };
};

// Cleanup helper
export const cleanup = async (server: FastifyInstance) => {
  await server.close();
  jest.clearAllMocks();
};

// Database test helpers
export const withTestDatabase = (testFn: () => Promise<void>) => {
  return async () => {
    // Setup test database
    // In a real application, you would:
    // 1. Create a test database
    // 2. Run migrations
    // 3. Seed test data
    
    try {
      await testFn();
    } finally {
      // Cleanup test database
      // 1. Drop test data
      // 2. Close connections
    }
  };
};

// Performance testing helpers
export const measureExecutionTime = async (fn: () => Promise<any>): Promise<{ result: any; duration: number }> => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1000000; // Convert to milliseconds
  
  return { result, duration };
};

export const expectPerformance = (duration: number, maxDuration: number) => {
  expect(duration).toBeLessThan(maxDuration);
};
