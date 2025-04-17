import { GameState, Move, Player, MoveType, mapData, Node } from '@yard/shared-utils';
import axios from 'axios';

interface AIMoveEvaluation {
  move: Move;
  score: number;
}

export class AIPlayerService {
  private apiKey: string;
  private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('OpenRouter API key not found. Using local AI logic.');
    }
  }

  private async getAIDecision(gameState: GameState, player: Player): Promise<Move | null> {
    if (!this.apiKey) return null;

    try {
      const prompt = this.createGameStatePrompt(gameState, player);
      
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek/deepseek-chat:free',
          messages: [{ 
            role: 'user', 
            content: prompt 
          }],
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const moveDecision = response.data.choices[0]?.message?.content;
      if (!moveDecision) return null;

      try {
        const parsedMove = JSON.parse(moveDecision);
        // Validate the move
        if (this.isValidMove(parsedMove, player)) {
          return {
            type: parsedMove.type as MoveType,
            position: parsedMove.position,
            secret: parsedMove.secret || false,
            double: parsedMove.double || false,
            role: player.role
          };
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
      }
    } catch (error) {
      console.error('OpenRouter API call failed:', error);
    }
    return null;
  }

  private createGameStatePrompt(gameState: GameState, player: Player): string {
    const currentNode = mapData.nodes.find(node => node.id === player.position);
    const possibleMoves = this.getPossibleMoves(currentNode, player);
    
    return `You are playing Scotland Yard as ${player.role}. Analyze this game state and choose the best move:

Current Position: ${player.position}
Available Tickets:
- Taxi: ${player.taxiTickets}
- Bus: ${player.busTickets}
- Underground: ${player.undergroundTickets}
${player.secretTickets ? `- Secret: ${player.secretTickets}` : ''}
${player.doubleTickets ? `- Double: ${player.doubleTickets}` : ''}

Possible Moves:
${JSON.stringify(possibleMoves, null, 2)}

Other Players' Positions:
${gameState.players
  .filter(p => p.role !== player.role)
  .map(p => `${p.role}: ${p.position}`)
  .join('\n')}

Last 3 Moves:
${JSON.stringify(gameState.moves.slice(-3), null, 2)}

Respond with a JSON object containing ONLY:
{
  "type": "taxi"|"bus"|"underground",
  "position": number,
  "secret": boolean,
  "double": boolean
}

Choose the move that best ${player.role === 'culprit' 
  ? 'helps you evade the detectives'
  : 'helps catch the culprit'}.`;
  }

  private isValidMove(move: any, player: Player): boolean {
    if (!move || typeof move !== 'object') return false;
    
    // Check required fields
    if (!move.type || !move.position) return false;
    
    // Validate move type
    if (!['taxi', 'bus', 'underground'].includes(move.type)) return false;

    // Check if player has required tickets
    if (move.type === 'taxi' && player.taxiTickets <= 0) return false;
    if (move.type === 'bus' && player.busTickets <= 0) return false;
    if (move.type === 'underground' && player.undergroundTickets <= 0) return false;
    if (move.secret && (!player.secretTickets || player.secretTickets <= 0)) return false;
    if (move.double && (!player.doubleTickets || player.doubleTickets <= 0)) return false;

    // Validate target position exists in the map
    const targetNode = mapData.nodes.find(node => node.id === move.position);
    if (!targetNode) return false;

    return true;
  }

  async calculateMove(gameState: GameState, player: Player): Promise<Move> {
    try {
      // First try to get a move from the AI service
      const aiMove = await this.getAIDecision(gameState, player);
      if (aiMove) {
        this.logMove(player, aiMove);
        return aiMove;
      }

      // Fallback to local logic if AI service fails
      console.log(`[AI Turn] Using local logic for ${player.role}`);
      
      const currentNode = mapData.nodes.find(node => node.id === player.position);
      if (!currentNode) {
        throw new Error(`Invalid position ${player.position} for player ${player.role}`);
      }

      // Get all possible moves
      const possibleMoves = this.getPossibleMoves(currentNode, player);
      if (possibleMoves.length === 0) {
        throw new Error(`No valid moves available from position ${player.position}`);
      }

      // Evaluate each possible move
      const evaluatedMoves: AIMoveEvaluation[] = possibleMoves.map(move => ({
        move: {
          type: move.type,
          position: move.targetPosition,
          secret: false,
          double: false,
          role: player.role
        },
        score: this.evaluateMove(move.targetPosition, player, gameState)
      }));

      // Sort moves by score and pick the best one
      evaluatedMoves.sort((a, b) => b.score - a.score);
      const bestMove = evaluatedMoves[0].move;

      // Consider using special tickets
      const shouldUseDouble = this.shouldUseDoubleTicket(bestMove, player, gameState);
      if (shouldUseDouble && player.doubleTickets && player.doubleTickets > 0) {
        bestMove.double = true;
      }

      this.logMove(player, bestMove, evaluatedMoves[0]);
      return bestMove;
    } catch (error) {
      this.logError(error as Error, player, 'Move calculation failed');
      return this.getFallbackMove(gameState, player);
    }
  }

  private getPossibleMoves(currentNode: Node | undefined, player: Player): Array<{ type: MoveType; targetPosition: number }> {
    try {
      const possibleMoves: Array<{ type: MoveType; targetPosition: number }> = [];

      if (!currentNode) return possibleMoves;

      // Check taxi connections
      if (currentNode.taxi && player.taxiTickets > 0) {
        currentNode.taxi.forEach((targetPosition: number) => {
          possibleMoves.push({ type: 'taxi', targetPosition });
        });
      }

      // Check bus connections
      if (currentNode.bus && player.busTickets > 0) {
        currentNode.bus.forEach((targetPosition: number) => {
          possibleMoves.push({ type: 'bus', targetPosition });
        });
      }

      // Check underground connections
      if (currentNode.underground && player.undergroundTickets > 0) {
        currentNode.underground.forEach((targetPosition: number) => {
          possibleMoves.push({ type: 'underground', targetPosition });
        });
      }

      return possibleMoves;
    } catch (error) {
      this.logError(error as Error, player, 'Getting possible moves failed');
      return [];
    }
  }

  private evaluateMove(targetPosition: number, player: Player, gameState: GameState): number {
    try {
      let score = 0;

      // Base score - prefer moves that use efficient transportation
      score += 10;

      if (player.role === 'culprit') {
        // Culprit strategy: Stay away from detectives
        const detectives = gameState.players.filter(p => p.role !== 'culprit');
        const distancesToDetectives = detectives.map(detective => 
          this.calculateDistance(targetPosition, detective.position)
        );
        
        // Higher score for positions further from detectives
        const minDistance = Math.min(...distancesToDetectives);
        score += minDistance * 5;
        
        console.log(`[AI Culprit] Minimum distance to detectives: ${minDistance}`);
        
        // Bonus for positions with more escape routes
        const targetNode = mapData.nodes.find(node => node.id === targetPosition);
        if (targetNode) {
          const escapeRoutes = [
            targetNode.taxi?.length || 0,
            targetNode.bus?.length || 0,
            targetNode.underground?.length || 0
          ].reduce((a, b) => a + b, 0);
          score += escapeRoutes * 2;
          
          console.log(`[AI Culprit] Escape routes at target: ${escapeRoutes}`);
        }
      } else {
        // Detective strategy: Get closer to the culprit
        const culprit = gameState.players.find(p => p.role === 'culprit');
        if (culprit) {
          const distanceToCulprit = this.calculateDistance(targetPosition, culprit.position);
          // Higher score for positions closer to culprit
          score += (20 - distanceToCulprit) * 5;
          
          console.log(`[AI Detective] Distance to culprit: ${distanceToCulprit}`);
        }
      }

      return score;
    } catch (error) {
      this.logError(error as Error, player, 'Move evaluation failed');
      return 0;
    }
  }

  private getFallbackMove(gameState: GameState, player: Player): Move {
    const currentNode = mapData.nodes.find(node => node.id === player.position);
    if (!currentNode || !currentNode.taxi || currentNode.taxi.length === 0) {
      return {
        type: 'taxi',
        position: player.position,
        secret: false,
        double: false,
        role: player.role
      };
    }

    return {
      type: 'taxi',
      position: currentNode.taxi[0],
      secret: false,
      double: false,
      role: player.role
    };
  }

  private calculateDistance(pos1: number, pos2: number): number {
    const node1 = mapData.nodes.find(node => node.id === pos1);
    const node2 = mapData.nodes.find(node => node.id === pos2);
    
    if (!node1 || !node2) return 999;

    // Calculate Manhattan distance using x,y coordinates
    return Math.abs(node1.x - node2.x) + Math.abs(node1.y - node2.y);
  }

  private shouldUseDoubleTicket(move: Move, player: Player, gameState: GameState): boolean {
    if (player.role === 'culprit') {
      // Use double ticket if any detective is too close
      const detectives = gameState.players.filter(p => p.role !== 'culprit');
      const closeDetective = detectives.some(detective => 
        this.calculateDistance(move.position, detective.position) <= 3
      );
      return closeDetective;
    } else {
      // Use double ticket if very close to culprit
      const culprit = gameState.players.find(p => p.role === 'culprit');
      if (culprit) {
        return this.calculateDistance(move.position, culprit.position) <= 2;
      }
    }
    return false;
  }

  private logMove(player: Player, move: Move, evaluation?: AIMoveEvaluation) {
    console.log(`[AI Move] ${player.role} moving from ${player.position} to ${move.position}`);
    console.log(`[AI Move] Transport: ${move.type}, Double: ${move.double}, Secret: ${move.secret}`);
    if (evaluation) {
      console.log(`[AI Move] Move score: ${evaluation.score}`);
    }
  }

  private logError(error: Error, player: Player, context: string) {
    console.error(`[AI Error] ${context} for ${player.role}:`, error.message);
    console.error(`[AI Error] Player state:`, {
      position: player.position,
      tickets: {
        taxi: player.taxiTickets,
        bus: player.busTickets,
        underground: player.undergroundTickets,
        secret: player.secretTickets,
        double: player.doubleTickets
      }
    });
  }
}
