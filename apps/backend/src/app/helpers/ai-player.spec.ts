import { AIPlayerService } from './ai-player';
import { GameState, Player, Role } from '@yard/shared-utils';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AIPlayerService', () => {
  let aiService: AIPlayerService;
  let mockGameState: GameState;
  let mockPlayer: Player;

  beforeEach(() => {
    jest.resetModules(); // Reset module registry to ensure a clean slate

    // Setup mock player at position 67 (a central node with multiple connections)
    mockPlayer = {
      id: 1,
      role: Role.detective1,
      position: 67,
      previousPosition: 52,
      taxiTickets: 10,
      busTickets: 8,
      undergroundTickets: 4,
      isAI: true
    };

    // Setup mock game state with culprit at position 89 (a node with underground station)
    mockGameState = {
      channel: 'test-channel',
      players: [
        mockPlayer,
        {
          id: 2,
          role: Role.culprit,
          position: 89,
          previousPosition: 105,
          taxiTickets: 4,
          busTickets: 3,
          undergroundTickets: 3,
          secretTickets: 2,
          doubleTickets: 2,
          isAI: false
        }
      ],
      currentTurn: Role.detective1,
      moves: [],
      isDoubleMove: false,
      status: 'active'
    };

    // Mock OpenRouter API response with a valid move to position 79
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              type: 'underground',
              position: 79,
              secret: false,
              double: false
            })
          }
        }]
      }
    });
  });

  describe('OpenRouter Integration', () => {
    beforeEach(() => {
      delete process.env.OPENROUTER_API_KEY; // Ensure API key is cleared before each test
      jest.clearAllMocks(); // Clear all mocks to avoid interference between tests
    });

    it('should attempt to use OpenRouter API when API key is available', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key'; // Set API key for this test
      aiService = new AIPlayerService();

      console.log(`[TEST DEBUG] API Key in test: ${process.env.OPENROUTER_API_KEY}`);

      const move = await aiService.calculateMove(mockGameState, mockPlayer);

      expect(mockedAxios.post).toHaveBeenCalled();
      expect(move).toBeDefined();
      expect(move.type).toBe('underground');
      expect(move.position).toBe(79);
    });

    it('should fall back to local logic when API key is not available', async () => {
      delete process.env.OPENROUTER_API_KEY; // Clear the API key before creating the service
      aiService = new AIPlayerService(); // Create the service after clearing the key

      console.log(`[TEST DEBUG] API Key in test: ${process.env.OPENROUTER_API_KEY}`);

      const move = await aiService.calculateMove(mockGameState, mockPlayer);

      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(move).toBeDefined();
      expect(['taxi', 'bus', 'underground']).toContain(move.type);

      // Adjust expected positions based on the move type
      const expectedPositions = {
        taxi: [51, 66, 68, 84],
        bus: [23, 52, 82, 102],
        underground: [13, 79, 89, 111],
      };

      expect(expectedPositions[move.type]).toContain(move.position);
    });

    it('should fall back to local logic when API call fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      const move = await aiService.calculateMove(mockGameState, mockPlayer);

      expect(move).toBeDefined();
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
      // Adjust expected positions based on the move type
      const expectedPositions = {
        taxi: [51, 66, 68, 84],
        bus: [23, 52, 82, 102],
        underground: [13, 79, 89, 111],
      };

      expect(expectedPositions[move.type]).toContain(move.position);
    });
  });

  describe('Local AI Logic', () => {
    beforeEach(() => {
      process.env.OPENROUTER_API_KEY = '';
    });

    it('should return a valid move for a detective', async () => {
      const move = await aiService.calculateMove(mockGameState, mockPlayer);

      expect(move).toBeDefined();
      expect(move.role).toBe(mockPlayer.role);
      // Position should be one of the valid connections from node 67
      const expectedPositions = {
        taxi: [51, 66, 68, 84],
        bus: [23, 52, 82, 102],
        underground: [13, 79, 89, 111],
      };

      expect(expectedPositions[move.type]).toContain(move.position);
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
      expect(typeof move.double).toBe('boolean');
      expect(typeof move.secret).toBe('boolean');
    });

    it('should handle the culprit role differently', async () => {
      const culpritPlayer = mockGameState.players.find(p => p.role === Role.culprit);
      const move = await aiService.calculateMove(mockGameState, culpritPlayer);

      expect(move).toBeDefined();
      expect(move.role).toBe(Role.culprit);
      // Position should be one of the valid connections from node 89
      expect([71, 88, 105]).toContain(move.position);
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
    });

    it('should consider available tickets when making moves', async () => {
      const limitedTicketsPlayer = {
        ...mockPlayer,
        taxiTickets: 0,
        busTickets: 1,
        undergroundTickets: 0
      };

      const move = await aiService.calculateMove(mockGameState, limitedTicketsPlayer);

      expect(move.type).toBe('bus');
      // Position should be one of the valid bus connections from node 67
      expect([23, 52, 82, 102]).toContain(move.position);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing player data gracefully', async () => {
      const invalidPlayer = {
        ...mockPlayer,
        position: undefined
      } as unknown as Player;

      const move = await aiService.calculateMove(mockGameState, invalidPlayer);
      expect(move).toBeDefined();
      expect(move.type).toBe('taxi');
      // Should return a valid position since we don't have a starting position
      expect(move.position).toBeGreaterThan(0);
    });

    it('should handle invalid game state gracefully', async () => {
      const invalidGameState = {
        ...mockGameState,
        players: []
      };

      const move = await aiService.calculateMove(invalidGameState, mockPlayer);
      expect(move).toBeDefined();
      expect(move.type).toBe('taxi');
      // Should try to use current position's connections
      expect(move.position).toBe(mockPlayer.position);
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network Error'));

      const move = await aiService.calculateMove(mockGameState, mockPlayer);
      expect(move).toBeDefined();
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
      // Should maintain current position when network error occurs
      expect(move.position).toBe(mockPlayer.position);
    });
  });
});
