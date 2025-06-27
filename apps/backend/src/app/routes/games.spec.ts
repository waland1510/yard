import { FastifyInstance } from 'fastify';
import { build } from '../../../test-helper';
import { GameState, Player, Role } from '@yard/shared-utils';

describe('Games Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/games/:channel', () => {
    it('should return 400 for invalid channel format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/games/invalid@channel',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent game', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/games/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return game data for valid channel', async () => {
      // First create a game
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {},
      });

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.body);
      const channel = createBody.createdGame.channel;

      // Then fetch it
      const response = await app.inject({
        method: 'GET',
        url: `/api/games/${channel}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.channel).toBe(channel);
      expect(body.players).toBeDefined();
      expect(body.currentTurn).toBeDefined();
      expect(body.moves).toBeDefined();
      expect(body.status).toBe('active');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const originalHasActiveGame = require('../helpers/db-operations').hasActiveGame;
      require('../helpers/db-operations').hasActiveGame = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/games/test-channel',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DATABASE_ERROR');

      // Restore original function
      require('../helpers/db-operations').hasActiveGame = originalHasActiveGame;
    });
  });

  describe('POST /api/games', () => {
    it('should create a new game with default settings', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.createdGame).toBeDefined();
      expect(body.createdGame.channel).toBeDefined();
      expect(body.createdGame.players).toHaveLength(6); // 1 culprit + 5 detectives
      expect(body.createdGame.currentTurn).toBe('culprit');
      expect(body.createdGame.status).toBe('active');
      expect(body.createdGame.isDoubleMove).toBe(false);
    });

    it('should create a game with AI players', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          aiRoles: ['detective1', 'detective2'],
          difficulty: 'hard',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.createdGame).toBeDefined();
    });

    it('should validate AI roles array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          aiRoles: ['invalid-role'],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should validate difficulty level', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          difficulty: 'invalid-difficulty',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should handle database errors during game creation', async () => {
      // Mock database error
      const originalCreateGame = require('../helpers/db-transactions').createGame;
      require('../helpers/db-transactions').createGame = jest.fn().mockRejectedValue(
        new Error('Database insert failed')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {},
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DATABASE_ERROR');

      // Restore original function
      require('../helpers/db-transactions').createGame = originalCreateGame;
    });
  });

  describe('PATCH /api/games/:id', () => {
    let gameId: number;

    beforeEach(async () => {
      // Create a test game
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {},
      });
      const body = JSON.parse(response.body);
      gameId = body.createdGame.id;
    });

    it('should update game status', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/games/${gameId}`,
        payload: {
          status: 'finished',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.updatedGame).toBeDefined();
    });

    it('should validate game ID format', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/games/invalid-id',
        payload: {
          status: 'finished',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should require at least one field to update', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/games/${gameId}`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should validate status values', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/games/${gameId}`,
        payload: {
          status: 'invalid-status',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/moves', () => {
    let gameId: number;

    beforeEach(async () => {
      // Create a test game
      const response = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {},
      });
      const body = JSON.parse(response.body);
      gameId = body.createdGame.id;
    });

    it('should add a valid move', async () => {
      const move = {
        gameId,
        role: 'culprit',
        type: 'taxi',
        position: 1,
        secret: false,
        double: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/moves',
        payload: move,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.updatedGame).toBeDefined();
    });

    it('should validate move data', async () => {
      const invalidMove = {
        gameId: 'invalid',
        role: 'invalid-role',
        type: 'invalid-type',
        position: -1,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/moves',
        payload: invalidMove,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should validate position range', async () => {
      const move = {
        gameId,
        role: 'culprit',
        type: 'taxi',
        position: 201, // Invalid position (max is 200)
        secret: false,
        double: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/moves',
        payload: move,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on game creation', async () => {
      const requests = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/games',
          payload: {},
        })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/games/test-channel',
      });

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-api-version']).toBe('1.0');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});
