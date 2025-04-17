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
    aiService = new AIPlayerService();
    
    // Setup mock player
    mockPlayer = {
      id: 1,
      role: Role.detective1,
      position: 100,
      previousPosition: 89,
      taxiTickets: 10,
      busTickets: 8,
      undergroundTickets: 4,
      isAI: true
    };

    // Setup mock game state
    mockGameState = {
      channel: 'test-channel',
      players: [
        mockPlayer,
        {
          id: 2,
          role: Role.culprit,
          position: 120,
          previousPosition: 115,
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

    // Mock OpenRouter API response
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({
              type: 'taxi',
              position: 101,
              secret: false,
              double: false
            })
          }
        }]
      }
    });
  });

  describe('OpenRouter Integration', () => {
    it('should attempt to use OpenRouter API when API key is available', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      const move = await aiService.calculateMove(mockGameState, mockPlayer);
      
      expect(mockedAxios.post).toHaveBeenCalled();
      expect(move).toBeDefined();
      expect(move.type).toBe('taxi');
      expect(move.position).toBe(101);
    });

    it('should fall back to local logic when API key is not available', async () => {
      process.env.OPENROUTER_API_KEY = '';
      const move = await aiService.calculateMove(mockGameState, mockPlayer);
      
      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(move).toBeDefined();
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
    });

    it('should fall back to local logic when API call fails', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      mockedAxios.post.mockRejectedValue(new Error('API Error'));
      
      const move = await aiService.calculateMove(mockGameState, mockPlayer);
      
      expect(move).toBeDefined();
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
    });

    it('should validate API response before using it', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                type: 'invalid',
                position: -1
              })
            }
          }]
        }
      });
      
      const move = await aiService.calculateMove(mockGameState, mockPlayer);
      
      expect(move).toBeDefined();
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
      expect(move.position).toBeGreaterThan(0);
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
      expect(move.position).toBeDefined();
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
      expect(typeof move.double).toBe('boolean');
      expect(typeof move.secret).toBe('boolean');
    });

    it('should handle the culprit role differently', async () => {
      const culpritPlayer = mockGameState.players.find(p => p.role === Role.culprit)!;
      const move = await aiService.calculateMove(mockGameState, culpritPlayer);

      expect(move).toBeDefined();
      expect(move.role).toBe(Role.culprit);
      expect(move.position).toBeDefined();
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
    });

    it('should handle invalid positions gracefully', async () => {
      const invalidPlayer = {
        ...mockPlayer,
        position: -1
      };

      const move = await aiService.calculateMove(mockGameState, invalidPlayer);
      
      expect(move).toBeDefined();
      expect(move.type).toBe('taxi');
      expect(move.role).toBe(invalidPlayer.role);
    });

    it('should properly evaluate distances between players', async () => {
      const closePlayer = {
        ...mockPlayer,
        position: 119 // Very close to culprit at 120
      };

      const move = await aiService.calculateMove(mockGameState, closePlayer);
      expect(move.double).toBe(true);
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
    });

    it('should handle invalid game state gracefully', async () => {
      const invalidGameState = {
        ...mockGameState,
        players: []
      };

      const move = await aiService.calculateMove(invalidGameState, mockPlayer);
      expect(move).toBeDefined();
      expect(move.type).toBe('taxi');
    });

    it('should handle network errors gracefully', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      mockedAxios.post.mockRejectedValue(new Error('Network Error'));

      const move = await aiService.calculateMove(mockGameState, mockPlayer);
      expect(move).toBeDefined();
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
    });
  });
});
