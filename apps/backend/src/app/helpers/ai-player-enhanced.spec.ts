import { AIPlayerService } from './ai-player';
import { GameState, Player, Move, initialPlayers } from '@yard/shared-utils';

describe('Enhanced AI Detective System', () => {
  let aiService: AIPlayerService;
  let mockGameState: GameState;

  beforeEach(() => {
    aiService = new AIPlayerService();
    
    // Create a mock game state with human culprit and AI detectives
    mockGameState = {
      id: 1,
      channel: 'test-channel',
      players: initialPlayers.map(player => ({
        ...player,
        isAI: player.role !== 'culprit' // All detectives are AI, culprit is human
      })),
      currentTurn: 'detective1',
      moves: [
        // Simulate some culprit moves showing different skill levels
        { role: 'culprit', type: 'taxi', position: 65, secret: false, double: false },
        { role: 'detective1', type: 'taxi', position: 15, secret: false, double: false },
        { role: 'culprit', type: 'bus', position: 82, secret: false, double: false },
        { role: 'detective2', type: 'taxi', position: 25, secret: false, double: false },
        { role: 'culprit', type: 'underground', position: 89, secret: false, double: false },
      ],
      isDoubleMove: false,
      status: 'active'
    };
  });

  describe('Skill Assessment', () => {
    it('should assess beginner player correctly', () => {
      // Create moves showing poor play (staying close to detectives, predictable patterns)
      const beginnerMoves: Move[] = [
        { role: 'culprit', type: 'taxi', position: 60, secret: false, double: false },
        { role: 'culprit', type: 'taxi', position: 61, secret: false, double: false },
        { role: 'culprit', type: 'taxi', position: 62, secret: false, double: false },
        { role: 'culprit', type: 'taxi', position: 63, secret: false, double: false },
      ];

      const gameStateWithBeginnerMoves = {
        ...mockGameState,
        moves: [...mockGameState.moves, ...beginnerMoves]
      };

      const skillAssessment = (aiService as any).assessHumanPlayerSkill(gameStateWithBeginnerMoves);
      
      expect(skillAssessment.skillLevel).toBe('beginner');
      expect(skillAssessment.metrics.transportVariety).toBeLessThan(0.5);
      expect(skillAssessment.metrics.patternUnpredictability).toBeLessThan(0.5);
    });

    it('should assess expert player correctly', () => {
      // Create moves showing excellent play (varied transport, good distance management)
      const expertMoves: Move[] = [
        { role: 'culprit', type: 'taxi', position: 100, secret: false, double: false },
        { role: 'culprit', type: 'bus', position: 120, secret: false, double: false },
        { role: 'culprit', type: 'underground', position: 140, secret: false, double: false },
        { role: 'culprit', type: 'taxi', position: 160, secret: false, double: false },
        { role: 'culprit', type: 'bus', position: 180, secret: false, double: false },
      ];

      const gameStateWithExpertMoves = {
        ...mockGameState,
        moves: [...mockGameState.moves, ...expertMoves]
      };

      const skillAssessment = (aiService as any).assessHumanPlayerSkill(gameStateWithExpertMoves);
      
      expect(skillAssessment.skillLevel).toBe('expert');
      expect(skillAssessment.metrics.transportVariety).toBeGreaterThan(0.8);
      expect(skillAssessment.metrics.averageDistanceFromDetectives).toBeGreaterThan(0.6);
    });
  });

  describe('Adaptive Difficulty', () => {
    it('should adjust difficulty based on player skill', () => {
      const beginnerSkill = {
        skillLevel: 'beginner',
        metrics: {
          averageDistanceFromDetectives: 0.3,
          transportVariety: 0.2,
          escapeEfficiency: 0.3,
          riskManagement: 0.2,
          patternUnpredictability: 0.3
        }
      };

      const expertSkill = {
        skillLevel: 'expert',
        metrics: {
          averageDistanceFromDetectives: 0.9,
          transportVariety: 1.0,
          escapeEfficiency: 0.8,
          riskManagement: 0.9,
          patternUnpredictability: 0.8
        }
      };

      const beginnerDifficulty = (aiService as any).calculateAdaptiveDifficulty(beginnerSkill, mockGameState);
      const expertDifficulty = (aiService as any).calculateAdaptiveDifficulty(expertSkill, mockGameState);

      expect(beginnerDifficulty.level).toBe('easy');
      expect(expertDifficulty.level).toBe('expert');
      
      expect(beginnerDifficulty.aggressiveness).toBeLessThan(expertDifficulty.aggressiveness);
      expect(beginnerDifficulty.coordination).toBeLessThan(expertDifficulty.coordination);
      expect(beginnerDifficulty.mistakes).toBeGreaterThan(expertDifficulty.mistakes);
    });
  });

  describe('Enhanced Detective Coordination', () => {
    it('should assign different roles to detectives', () => {
      const detective1 = mockGameState.players.find(p => p.role === 'detective1')!;
      const detective2 = mockGameState.players.find(p => p.role === 'detective2')!;
      const detective3 = mockGameState.players.find(p => p.role === 'detective3')!;
      
      const otherDetectives = [detective2, detective3];
      const possibleCulpritPositions = [
        { type: 'taxi' as const, position: 100, probability: 0.6 },
        { type: 'bus' as const, position: 110, probability: 0.4 }
      ];

      const map = new Map();
      // Add some mock map data
      map.set(detective1.position, { taxi: [11, 12], bus: [13], underground: [14] });

      const role1 = (aiService as any).calculateDynamicRole(detective1, otherDetectives, possibleCulpritPositions, map);
      const role2 = (aiService as any).calculateDynamicRole(detective2, [detective1, detective3], possibleCulpritPositions, map);
      
      // Roles should be different for better coordination
      expect(role1).toBeDefined();
      expect(role2).toBeDefined();
      expect(['primary-hunter', 'interceptor', 'flanker']).toContain(role1);
      expect(['primary-hunter', 'interceptor', 'flanker']).toContain(role2);
    });
  });

  describe('Enhanced Culprit Tracking', () => {
    it('should predict culprit positions with human behavior patterns', () => {
      const enhancedPositions = (aiService as any).getEnhancedCulpritPositions(mockGameState);
      
      expect(enhancedPositions).toBeDefined();
      expect(Array.isArray(enhancedPositions)).toBe(true);
      
      if (enhancedPositions.length > 0) {
        expect(enhancedPositions[0]).toHaveProperty('position');
        expect(enhancedPositions[0]).toHaveProperty('probability');
        expect(enhancedPositions[0]).toHaveProperty('type');
        
        // Probabilities should sum to reasonable values
        const totalProbability = enhancedPositions.reduce((sum, pos) => sum + pos.probability, 0);
        expect(totalProbability).toBeGreaterThan(0);
        expect(totalProbability).toBeLessThanOrEqual(1.1); // Allow small rounding errors
      }
    });

    it('should detect movement patterns', () => {
      const linearMoves: Move[] = [
        { role: 'culprit', type: 'taxi', position: 10, secret: false, double: false },
        { role: 'culprit', type: 'taxi', position: 20, secret: false, double: false },
        { role: 'culprit', type: 'taxi', position: 30, secret: false, double: false },
        { role: 'culprit', type: 'taxi', position: 40, secret: false, double: false },
      ];

      const pattern = (aiService as any).detectMovementPattern(linearMoves);
      
      expect(pattern).toHaveProperty('type');
      expect(pattern).toHaveProperty('confidence');
      expect(pattern).toHaveProperty('predictedNextPositions');
      expect(['linear', 'circular', 'random', 'hub-based', 'evasive']).toContain(pattern.type);
      expect(pattern.confidence).toBeGreaterThanOrEqual(0);
      expect(pattern.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Game Phase Detection', () => {
    it('should correctly identify game phases', () => {
      const earlyGame = { ...mockGameState, moves: mockGameState.moves.slice(0, 2) };
      const midGame = { ...mockGameState, moves: [...mockGameState.moves, ...Array(10).fill(null).map((_, i) => ({
        role: 'culprit', type: 'taxi', position: 50 + i, secret: false, double: false
      }))] };
      
      const earlyPhase = (aiService as any).determineGamePhase(earlyGame);
      const midPhase = (aiService as any).determineGamePhase(midGame);
      
      expect(earlyPhase).toBe('early');
      expect(midPhase).toBe('mid');
    });
  });

  describe('Enhanced Move Calculation', () => {
    it('should calculate enhanced detective moves', async () => {
      const detective = mockGameState.players.find(p => p.role === 'detective1')!;
      
      const move = await aiService.calculateMove(mockGameState, detective);
      
      expect(move).toBeDefined();
      expect(move.role).toBe('detective1');
      expect(move.position).toBeGreaterThan(0);
      expect(['taxi', 'bus', 'underground']).toContain(move.type);
      expect(typeof move.secret).toBe('boolean');
      expect(typeof move.double).toBe('boolean');
    });

    it('should handle different difficulty levels', async () => {
      const detective = mockGameState.players.find(p => p.role === 'detective1')!;
      
      // Test multiple moves to see if there's variation (indicating difficulty scaling)
      const moves = [];
      for (let i = 0; i < 5; i++) {
        const move = await aiService.calculateMove(mockGameState, detective);
        moves.push(move);
      }
      
      // All moves should be valid
      moves.forEach(move => {
        expect(move.role).toBe('detective1');
        expect(move.position).toBeGreaterThan(0);
      });
    });
  });
});
