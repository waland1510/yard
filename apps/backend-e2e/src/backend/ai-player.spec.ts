import axios from 'axios';
import WebSocket from 'ws';
import { GameState, Move, Player, Role } from '@yard/shared-utils';

describe('AI Player Integration', () => {
  let ws: WebSocket;
  let gameState: GameState;
  let aiPlayer: Player;

  beforeAll(async () => {
    // Create a new game with an AI player
    const response = await axios.post(`${process.env.API_URL}/api/games`, {
      aiRoles: ['detective1']
    });
    gameState = response.data.createdGame;
    aiPlayer = gameState.players.find(p => p.isAI)!;
  });

  beforeEach(() => {
    ws = new WebSocket(`${process.env.WS_URL}/wss`);
  });

  afterEach(() => {
    ws.close();
  });

  it('should automatically make moves for AI players', (done) => {
    let moveCount = 0;

    ws.on('open', () => {
      // Join the game channel
      ws.send(JSON.stringify({
        type: 'startGame',
        data: { ch: gameState.channel }
      }));

      // Trigger a move that will result in AI's turn
      ws.send(JSON.stringify({
        type: 'makeMove',
        data: {
          gameId: gameState.id,
          role: 'culprit',
          type: 'taxi',
          position: 89,
          gameState,
          isAI: false
        }
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'makeMove') {
        moveCount++;
        
        // First move is our trigger move
        if (moveCount === 1) {
          expect(message.data.role).toBe('culprit');
        }
        
        // Second move should be AI's response
        if (moveCount === 2) {
          expect(message.data.role).toBe(aiPlayer.role);
          expect(['taxi', 'bus', 'underground']).toContain(message.data.type);
          expect(typeof message.data.position).toBe('number');
          done();
        }
      }
    });
  });

  it('should respect ticket limitations for AI moves', (done) => {
    // Set up a game state where AI has limited tickets
    const limitedTicketsAI = {
      ...aiPlayer,
      taxiTickets: 0,
      busTickets: 1,
      undergroundTickets: 0
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'makeMove',
        data: {
          gameId: gameState.id,
          role: 'culprit',
          type: 'taxi',
          position: 89,
          gameState: {
            ...gameState,
            players: gameState.players.map(p => 
              p.role === limitedTicketsAI.role ? limitedTicketsAI : p
            )
          },
          isAI: false
        }
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'makeMove' && message.data.role === limitedTicketsAI.role) {
        expect(message.data.type).toBe('bus');
        done();
      }
    });
  });

  it('should handle AI move errors gracefully', (done) => {
    // Set up a game state with invalid position
    const invalidAI = {
      ...aiPlayer,
      position: -1
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'makeMove',
        data: {
          gameId: gameState.id,
          role: 'culprit',
          type: 'taxi',
          position: 89,
          gameState: {
            ...gameState,
            players: gameState.players.map(p => 
              p.role === invalidAI.role ? invalidAI : p
            )
          },
          isAI: false
        }
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'makeMove' && message.data.role === invalidAI.role) {
        // Should still make a valid move despite invalid position
        expect(message.data.position).toBeGreaterThanOrEqual(0);
        expect(['taxi', 'bus', 'underground']).toContain(message.data.type);
        done();
      }
    });
  });

  it('should make strategic moves based on game state', (done) => {
    // Set up a game state where culprit is close to detective
    const strategicGameState: GameState = {
      ...gameState,
      players: gameState.players.map(p => 
        p.role === 'culprit' 
          ? { ...p, position: aiPlayer.position + 1 } // Place culprit adjacent to AI
          : p
      )
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'makeMove',
        data: {
          gameId: gameState.id,
          role: 'culprit',
          type: 'taxi',
          position: aiPlayer.position + 1,
          gameState: strategicGameState,
          isAI: false
        }
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'makeMove' && message.data.role === aiPlayer.role) {
        // Should use double ticket when close to culprit
        expect(message.data.double).toBe(true);
        done();
      }
    });
  });
});
