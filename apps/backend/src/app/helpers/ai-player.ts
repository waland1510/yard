import { GameState, Move, Player, MoveType, mapData, Node } from '@yard/shared-utils';
import { getGeminiAIDecision } from './ai-decision-gemini';
import { getOpenRouterAIDecision } from './ai-decision-openrouter';
import { decideLocalMove } from './local-move-decision';

interface AIMoveEvaluation {
  move: Move;
  score: number;
}

export class AIPlayerService {

  private async getAIDecision(gameState: GameState, player: Player): Promise<Move | null> {
    const prompt = this.createGameStatePrompt(gameState, player);
    console.log('[AI Decision] Preparing prompt for API call.', prompt);

    // Try Gemini API first
    try {
      return await getGeminiAIDecision(prompt, player);
    } catch (geminiError) {
      console.error('[AI Decision] Gemini API call failed:', geminiError);
    }

    // Fallback to OpenRouter API
    try {
      return await getOpenRouterAIDecision(prompt, player);
    } catch (openRouterError) {
      console.error('[AI Decision] OpenRouter API call failed:', openRouterError);
    }

    return null;
  }

  private createGameStatePrompt(gameState: GameState, player: Player): string {
    const currentNode = mapData.nodes.find(node => node.id === player.position);
    const possibleMoves = this.getPossibleMoves(currentNode, player);

    return `You are playing Scotland Yard (Milton Bradley version) as ${player.role}.The game is played with one culprit (Mr. X) and five detectives. Analyze this game state and choose the best move:

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

Last 5 Moves:
${JSON.stringify(gameState.moves.slice(-5), null, 2)}

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
      return decideLocalMove(gameState, player);
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

  private getFallbackMove(gameState: GameState, player: Player): Move {
    try {
        const currentNode = mapData.nodes.find(node => node.id === player.position);

        // If the current position is invalid or no connections are available, stay in place
        if (!player.position || !currentNode || this.getPossibleMoves(currentNode, player).length === 0) {
            return {
                type: 'taxi',
                position: player.position || 1, // Default to position 1 if no position is available
                secret: false,
                double: false,
                role: player.role
            };
        }

        // Explicitly prioritize staying in the current position
        return {
            type: 'taxi',
            position: player.position,
            secret: false,
            double: false,
            role: player.role
        };
    } catch (error) {
        // Log error and stay in place
        this.logError(error as Error, player, 'Fallback move calculation failed');
        return {
            type: 'taxi',
            position: player.position || 1,
            secret: false,
            double: false,
            role: player.role
        };
    }
  }

  private calculateDistance(pos1: number, pos2: number): number {
    const node1 = mapData.nodes.find(node => node.id === pos1);
    const node2 = mapData.nodes.find(node => node.id === pos2);

    if (!node1 || !node2) return 999;

    // Calculate Manhattan distance using x,y coordinates
    return Math.abs(node1.x - node2.x) + Math.abs(node1.y - node2.y);
  }

  private shouldUseDoubleTicket(move: Move, player: Player, gameState: GameState): boolean {
    // Don't use double ticket if player doesn't have any
    if (!player.doubleTickets || player.doubleTickets <= 0) return false;

    if (player.role === 'culprit') {
      // Use double ticket if any detective is too close (within 2 moves)
      const detectives = gameState.players.filter(p => p.role !== 'culprit');
      const closeDetective = detectives.some(detective =>
        this.calculateDistance(move.position, detective.position) <= 2
      );
      return closeDetective;
    } else {
      // Use double ticket if very close to culprit (within 1 move)
      const culprit = gameState.players.find(p => p.role === 'culprit');
      if (culprit) {
        const distance = this.calculateDistance(move.position, culprit.position);
        return distance <= 1;
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
