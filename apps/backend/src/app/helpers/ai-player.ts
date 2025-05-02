import { GameState, Move, Player, MoveType, mapData, Node, showCulpritAtMoves, PredictedCulpritMove } from '@yard/shared-utils';
import { getGeminiAIDecision } from './ai-decision-gemini';
import { getOpenRouterAIDecision } from './ai-decision-openrouter';
import { decideLocalMove } from './local-move-decision';


type NodeConnections = {
  taxi?: number[];
  bus?: number[];
  underground?: number[];
};

function findShortestPath(
  map: Map<number, NodeConnections>,
  player: Player,
  targets: number[],
  maxDepth = Infinity
): number[] | null {
  const visited = new Set<number>();
  const queue: { path: number[]; taxi: number; bus: number; underground: number }[] = [{
    path: [player.position],
    taxi: player.taxiTickets,
    bus: player.busTickets,
    underground: player.undergroundTickets,
  }];

  while (queue.length > 0) {
    const { path, taxi, bus, underground } = queue.shift();
    const current = path[path.length - 1];

    if (targets.includes(current)) return path;
    if (path.length > maxDepth) continue;
    if (visited.has(current)) continue;

    visited.add(current);

    const node = map.get(current);
    if (!node) continue;

    if (taxi > 0 && node.taxi) {
      for (const next of node.taxi) {
        queue.push({
          path: [...path, next],
          taxi: taxi - 1,
          bus,
          underground,
        });
      }
    }

    if (bus > 0 && node.bus) {
      for (const next of node.bus) {
        queue.push({
          path: [...path, next],
          taxi,
          bus: bus - 1,
          underground,
        });
      }
    }

    if (underground > 0 && node.underground) {
      for (const next of node.underground) {
        queue.push({
          path: [...path, next],
          taxi,
          bus,
          underground: underground - 1,
        });
      }
    }
  }

  return null;
}

function getNextDetectiveMove(
  map: Map<number, NodeConnections>,
  detective: Player,
  mrXPositions: number[] | PredictedCulpritMove[],
  otherDetectives: Player[]
): number | null {
  const paths = mrXPositions
    .map(position => findShortestPath(map, detective, [position]))
    .filter(path => path !== null) as number[][];

  if (paths.length === 0) return null;

  const occupiedPositions = new Set(otherDetectives.map(d => d.position));

  for (const path of paths) {
    const nextPosition = path[1];
    if (!occupiedPositions.has(nextPosition)) {
      return nextPosition;
    }
  }

  return null;
}

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
    const possibleMoves = this.getPossibleMovesWithDetails(currentNode, player, gameState);

    const strategicInfo = this.generateStrategicInfo(gameState, player, possibleMoves);
    const map = new Map<number, NodeConnections>(
      mapData.nodes.map(node => [node.id, node])
    );
    const predictedCulpritMoves = this.getPossibleCulpritPositions(gameState, map);
    return `You are playing Scotland Yard (Milton Bradley version) as ${player.role}. The game is played with one culprit (Mr. X) and five detectives. Analyze this game state and choose the best move:

Current Position: ${player.position}
Available Tickets:
- Taxi: ${player.taxiTickets}
- Bus: ${player.busTickets}
- Underground: ${player.undergroundTickets}
${player.secretTickets ? `- Secret: ${player.secretTickets}` : ''}
${player.doubleTickets ? `- Double: ${player.doubleTickets}` : ''}

Possible Moves:
${JSON.stringify(possibleMoves, null, 2)}

Strategic Information:
${strategicInfo}

Other Players' Positions:
${gameState.players
  .filter(p => p.role !== player.role)
  .map(p => {
    if (p.role === 'culprit' && !showCulpritAtMoves.includes(gameState.moves.filter(move => move.role === 'culprit').length)) {
      return `${p.role}: hidden`;
    }
    return `${p.role}: ${p.position}`;
  })
  .join('\n')}

  Predicted Culprit Moves:
${JSON.stringify(predictedCulpritMoves, null, 2)}

Last 5 Moves:
${JSON.stringify(
  gameState.moves.slice(-5).map(move => {
    if (move.role === 'culprit' && !showCulpritAtMoves.includes(gameState.moves.filter(m => m.role === 'culprit').indexOf(move) + 1)) {
      return { ...move, position: 'hidden' }; // Hide position if not in open moves
    }
    return move;
  }),
  null,
  2
)}

Last Culprit Moves:
${JSON.stringify(
  gameState.moves
    .filter(move => move.role === 'culprit')
    .slice(-6) // Include the last 6 moves to ensure open moves are present
    .map(move => {
      if (!showCulpritAtMoves.includes(gameState.moves.filter(m => m.role === 'culprit').indexOf(move) + 1)) {
        return { ...move, position: 'hidden' }; // Hide position if not in open moves
      }
      return move;
    }),
  null,
  2
)}

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

  private getMovesForPlayers(
    players: Player[],
    gameState: GameState,
    includeDetails = false
  ): Map<string, Array<{ type: MoveType; targetPosition: number; score?: number; blockedBy?: string[] }>> {
    const map = new Map<number, NodeConnections>(mapData.nodes.map(node => [node.id, node]));
    const moves = new Map<string, Array<{ type: MoveType; targetPosition: number; score?: number; blockedBy?: string[] }>>();

    const detectives = gameState.players.filter(p => p.role !== 'culprit');
    const detectivePositions = new Map(detectives.map(d => [d.position, d.role])); // Efficient lookup for blocking detectives

    for (const player of players) {
      const currentNode = map.get(player.position);
      if (!currentNode) {
        moves.set(player.role, []);
        continue;
      }

      const playerMoves: Array<{ type: MoveType; targetPosition: number; score?: number; blockedBy?: string[] }> = [];

      const addMoveDetails = (type: MoveType, targetPosition: number) => {
        const moveDetails: { type: MoveType; targetPosition: number; score?: number; blockedBy?: string[] } = { type, targetPosition };

        if (includeDetails) {
          const distanceToCulprit = this.calculateDistance(targetPosition, player.position);
          const isBottleneck = this.isBottleneck(map, targetPosition);
          moveDetails.score = (isBottleneck ? 10 : 0) - distanceToCulprit; // Example scoring logic
          moveDetails.blockedBy = detectivePositions.has(targetPosition) ? [detectivePositions.get(targetPosition)] : [];
        }

        playerMoves.push(moveDetails);
      };

      if (currentNode.taxi && player.taxiTickets > 0) {
        currentNode.taxi.forEach(targetPosition => addMoveDetails('taxi', targetPosition));
      }

      if (currentNode.bus && player.busTickets > 0) {
        currentNode.bus.forEach(targetPosition => addMoveDetails('bus', targetPosition));
      }

      if (currentNode.underground && player.undergroundTickets > 0) {
        currentNode.underground.forEach(targetPosition => addMoveDetails('underground', targetPosition));
      }

      moves.set(player.role, playerMoves);
    }

    return moves;
  }

  private getPossibleMovesWithDetails(
    currentNode: Node | undefined,
    player: Player,
    gameState: GameState
  ): Array<{ type: MoveType; targetPosition: number; score: number; blockedBy: string[] }> {
    const moves = (this.getMovesForPlayers([player], gameState, true).get(player.role) || []).map(move => ({
      ...move,
      score: move.score ?? 0,
      blockedBy: move.blockedBy ?? [],
    }));

    // Enhance scores with simulation
    return moves.map(move => {
      const simulationScore = this.simulateFutureStates(gameState, player, {
        type: move.type,
        position: move.targetPosition,
        secret: false,
        double: this.shouldUseDoubleTicket({ type: move.type, position: move.targetPosition, secret: false, double: false, role: player.role }, player, gameState),
        role: player.role,
      });
      return {
        ...move,
        score: move.score + simulationScore * 0.5, // Combine heuristic and simulation scores
      };
    });
  }

  private getAllPossibleMovesForAllRoles(
    gameState: GameState
  ): Map<string, Array<{ type: MoveType; targetPosition: number }>> {
    return this.getMovesForPlayers(gameState.players, gameState, false);
  }

  private getPossibleCulpritPositions(
    gameState: GameState,
    map: Map<number, NodeConnections>
  ): PredictedCulpritMove[] {
    const culpritMoves = gameState.moves.filter(move => move.role === 'culprit');
    const currentMoveNumber = culpritMoves.length;
    const lastRevealedMoveIndex = culpritMoves
      .map((_, index) => index + 1)
      .reverse()
      .find(index => showCulpritAtMoves.includes(index));

    if (lastRevealedMoveIndex === undefined) return [];

    const lastRevealedPosition = culpritMoves[lastRevealedMoveIndex - 1]?.position;
    if (!lastRevealedPosition) return [];

    const culprit = gameState.players.find(p => p.role === 'culprit');
    if (!culprit) return [];

    // Initialize with the last known position
    let positionProbs: Map<number, { prob: number; type: MoveType | null }> = new Map([
      [lastRevealedPosition, { prob: 1.0, type: null }],
    ]);

    // Simulate moves from last revealed to current
    for (let i = lastRevealedMoveIndex; i < currentMoveNumber; i++) {
      const newPositionProbs = new Map<number, { prob: number; type: MoveType | null }>();
      const totalWeight = Array.from(positionProbs.values()).reduce((sum, entry) => sum + entry.prob, 0);

      for (const [position, { prob }] of positionProbs) {
        const node = map.get(position);
        if (!node) continue;

        // Available transports based on tickets
        const transports: { type: MoveType; connections: number[] }[] = [];
        if (culprit.taxiTickets > 0 || culprit.secretTickets > 0) {
          transports.push({ type: 'taxi', connections: node.taxi || [] });
        }
        if (culprit.busTickets > 0 || culprit.secretTickets > 0) {
          transports.push({ type: 'bus', connections: node.bus || [] });
        }
        if (culprit.undergroundTickets > 0 || culprit.secretTickets > 0) {
          transports.push({ type: 'underground', connections: node.underground || [] });
        }

        // Distribute probability across possible moves
        const totalConnections = transports.reduce((sum, t) => sum + t.connections.length, 0);
        if (totalConnections === 0) continue;

        for (const { type, connections } of transports) {
          for (const next of connections) {
            const weight = this.calculatePositionWeight(next, gameState, map);
            const moveProb = (prob / totalConnections) * weight;
            newPositionProbs.set(next, {
              prob: (newPositionProbs.get(next)?.prob || 0) + moveProb,
              type,
            });
          }
        }
      }

      // Normalize probabilities
      positionProbs = new Map(
        Array.from(newPositionProbs.entries()).map(([pos, entry]) => [
          pos,
          { prob: entry.prob / totalWeight, type: entry.type },
        ])
      );
    }

    // Convert to PredictedCulpritMove format
    const result: PredictedCulpritMove[] = [];
    for (const [position, { prob, type }] of positionProbs) {
      const node = map.get(position);
      if (!node) continue;

      const possibleTypes: MoveType[] = [];
      if (type) {
        possibleTypes.push(type);
      } else {
        // For the starting position, infer possible types based on tickets
        if (node.taxi?.length && (culprit.taxiTickets > 0 || culprit.secretTickets > 0)) possibleTypes.push('taxi');
        if (node.bus?.length && (culprit.busTickets > 0 || culprit.secretTickets > 0)) possibleTypes.push('bus');
        if (node.underground?.length && (culprit.undergroundTickets > 0 || culprit.secretTickets > 0)) possibleTypes.push('underground');
      }

      possibleTypes.forEach(t => {
        result.push({ type: t, position, probability: prob / possibleTypes.length });
      });
    }

    // Sort by probability and limit to top 5
    return result
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5)
      .filter(move => move.probability > 0.01); // Filter out negligible probabilities
  }

  private calculatePositionWeight(position: number, gameState: GameState, map: Map<number, NodeConnections>): number {
    const node = map.get(position);
    if (!node) return 0.1;

    // Factors:
    // 1. Distance from detectives (farther is better)
    const detectives = gameState.players.filter(p => p.role !== 'culprit');
    const minDistance = Math.min(
      ...detectives.map(d => this.calculateDistance(position, d.position))
    );
    const distanceScore = minDistance / 100; // Normalize

    // 2. Node connectivity (more exits are better)
    const exitCount = this.getExitCount(map, position);
    const connectivityScore = exitCount / 10;

    // 3. Avoid recent detective positions
    const recentDetectivePositions = new Set(
      gameState.moves
        .filter(m => m.role !== 'culprit')
        .slice(-10)
        .map(m => m.position)
    );
    const isSafe = !recentDetectivePositions.has(position) ? 1.0 : 0.5;

    return distanceScore + connectivityScore + isSafe;
  }

  private generateStrategicInfo(
    gameState: GameState,
    player: Player,
    possibleMoves: Array<{ type: MoveType; targetPosition: number }>
  ): string {
    const currentMoveNumber = gameState.moves.filter(move => move.role === 'culprit').length;
    const culprit = gameState.players.find(p => p.role === 'culprit');
    const detectives = gameState.players.filter(p => p.role !== 'culprit');
    const map = new Map<number, NodeConnections>(
      mapData.nodes.map(node => [node.id, node])
    );

    const culpritPosition = showCulpritAtMoves.includes(currentMoveNumber) ? culprit?.position : null;
    const possibleCulpritPositions = culpritPosition
      ? [culpritPosition]
      : this.getPossibleCulpritPositions(gameState, map);

    const allPossibleMoves = this.getAllPossibleMovesForAllRoles(gameState);

    const groupedPositions = detectives.map(detective => {
      const positions = possibleCulpritPositions.map(pos => ({
        position: pos,
        distance: this.calculateDistance(detective.position, pos)
      }));
      positions.sort((a, b) => a.distance - b.distance);
      return {
        detective: detective.role,
        closestPositions: positions.slice(0, 5)
      };
    });

    const detectiveMoves = this.resolveDetectivesMoves(map, detectives, possibleCulpritPositions);

    const strategicDetails = possibleMoves.map(move => {
      const distanceToCulprit = culpritPosition !== null
        ? this.calculateDistance(move.targetPosition, culpritPosition)
        : 'unknown';
      const isBottleneck = this.isBottleneck(map, move.targetPosition);
      const exitCount = this.getExitCount(map, move.targetPosition);
      const isKeyPosition = this.isKeyPosition(move.targetPosition);

      return `- ${move.targetPosition} (${move.type}): ${distanceToCulprit} hops from the culprit, ${
        isBottleneck ? 'part of a bottleneck' : 'not a bottleneck'
      }, ${exitCount} exit${exitCount === 1 ? '' : 's'}, ${
        isKeyPosition ? 'key map position' : 'regular position'
      }.`;
    });

    const historicallyRelevantPositions = gameState.moves
      .filter(move => move.role === 'culprit' && move.position !== null)
      .map(move => move.position);

    const additionalInsights = [
      culpritPosition !== null
        ? `Mr. X is ${this.calculateMovesToSurround(map, culprit, detectives)} moves away from being surrounded.`
        : `Culprit position is currently hidden. Possible positions grouped by proximity:
${groupedPositions
  .map(group => `${group.detective}: ${group.closestPositions.map(p => `${p.position} (${p.distance} hops)`).join(', ')}`)
  .join('\n')}`,
      `Historically Relevant Positions: ${historicallyRelevantPositions.join(', ')}`,
      ...detectives.map(d => {
        const advice = currentMoveNumber <= 2
          ? 'Aim to reach an underground station by move 3 for better mobility.'
          : '';
        return `${d.role} has the following tickets left:
      - Taxi: ${d.taxiTickets}
      - Bus: ${d.busTickets}
      - Underground: ${d.undergroundTickets}
      ${advice}`;
      }),
      `Predicted Detective Moves: ${Array.from(detectiveMoves.entries())
        .map(([role, move]) => `${role}: ${move !== null ? `to ${move}` : 'no move'}`)
        .join(', ')}`,
      `All Possible Moves for All Roles:
${Array.from(allPossibleMoves.entries())
  .map(([role, moves]) => `${role}: ${moves.map(m => `${m.type} to ${m.targetPosition}`).join(', ')}`)
  .join('\n')}`
    ];

    return `${strategicDetails.join('\n')}\n\nSuggested Insights:\n${additionalInsights.join('\n')}`;
  }

  private isKeyPosition(position: number): boolean {
    const node = mapData.nodes.find(node => node.id === position);
    if (!node) return false;

    // Example logic: flag positions with underground or river connections as key
    return (node.underground?.length || 0) > 0 || (node.river?.length || 0) > 0;
  }

  private isBottleneck(map: Map<number, NodeConnections>, position: number): boolean {
    const node = map.get(position);
    if (!node) return false;

    const totalConnections =
      (node.taxi?.length || 0) +
      (node.bus?.length || 0) +
      (node.underground?.length || 0);

    return totalConnections === 1; // A bottleneck has only one exit
  }

  private getExitCount(map: Map<number, NodeConnections>, position: number): number {
    const node = map.get(position);
    if (!node) return 0;

    return (
      (node.taxi?.length || 0) +
      (node.bus?.length || 0) +
      (node.underground?.length || 0)
    );
  }

  private calculateMovesToSurround(
    map: Map<number, NodeConnections>,
    culprit: Player,
    detectives: Player[]
  ): number {
    const detectivePositions = new Set(detectives.map(d => d.position));
    const culpritNode = map.get(culprit.position);

    if (!culpritNode) return Infinity;

    const exits = [
      ...(culpritNode.taxi || []),
      ...(culpritNode.bus || []),
      ...(culpritNode.underground || [])
    ];

    const freeExits = exits.filter(exit => !detectivePositions.has(exit));
    return freeExits.length;
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
    return Math.abs(node1.x - node2.x) + Math.abs(node2.y - node1.y);
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

  resolveDetectivesMoves(
    map: Map<number, NodeConnections>,
    detectives: Player[],
    mrXPositions: number[] | PredictedCulpritMove[]
  ): Map<string, number | null> { // Use roles as keys
    const moves = new Map<string, number | null>();
    const occupied = new Set<number>(detectives.map(d => d.position));

    for (const detective of detectives) {
      const others = detectives.filter(d => d.role !== detective.role);
      const move = getNextDetectiveMove(map, detective, mrXPositions, others);
      if (move !== null && !occupied.has(move)) {
        moves.set(detective.role, move); // Use role instead of ID
        occupied.add(move);
      } else {
        moves.set(detective.role, null);
      }
    }

    return moves;
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

  private simulateFutureStates(
    gameState: GameState,
    player: Player,
    move: Move,
    depth = 3,
    simulations = 50
  ): number {
    const map = new Map<number, NodeConnections>(
      mapData.nodes.map(node => [node.id, node])
    );
    let totalScore = 0;

    for (let i = 0; i < simulations; i++) {
      totalScore += this.runSimulation(gameState, player, move, map, depth);
    }

    return totalScore / simulations;
  }

  private runSimulation(
    gameState: GameState,
    player: Player,
    initialMove: Move,
    map: Map<number, NodeConnections>,
    depth: number
  ): number {
    const simulatedState = this.cloneGameState(gameState);
    const playerIndex = simulatedState.players.findIndex(p => p.role === player.role);

    // Apply the initial move
    simulatedState.players[playerIndex] = {
      ...simulatedState.players[playerIndex],
      position: initialMove.position,
      taxiTickets: initialMove.type === 'taxi' ? player.taxiTickets - 1 : player.taxiTickets,
      busTickets: initialMove.type === 'bus' ? player.busTickets - 1 : player.busTickets,
      undergroundTickets: initialMove.type === 'underground' ? player.undergroundTickets - 1 : player.undergroundTickets,
      secretTickets: initialMove.secret ? player.secretTickets - 1 : player.secretTickets,
      doubleTickets: initialMove.double ? player.doubleTickets - 1 : player.doubleTickets,
    };
    simulatedState.moves.push({ ...initialMove, role: player.role });

    // Simulate future turns
    for (let d = 0; d < depth; d++) {
      // Simulate Mr. X's move
      const culprit = simulatedState.players.find(p => p.role === 'culprit');
      if (culprit) {
        const predictedMoves = this.getPossibleCulpritPositions(simulatedState, map);
        if (predictedMoves.length > 0) {
          // Choose a move probabilistically
          const totalProb = predictedMoves.reduce((sum, m) => sum + m.probability, 0);
          const rand = Math.random() * totalProb;
          let cumulative = 0;
          let selectedMove: PredictedCulpritMove | undefined;
          for (const move of predictedMoves) {
            cumulative += move.probability;
            if (rand <= cumulative) {
              selectedMove = move;
              break;
            }
          }
          if (selectedMove) {
            culprit.position = selectedMove.position;
            culprit.taxiTickets -= selectedMove.type === 'taxi' ? 1 : 0;
            culprit.busTickets -= selectedMove.type === 'bus' ? 1 : 0;
            culprit.undergroundTickets -= selectedMove.type === 'underground' ? 1 : 0;
            simulatedState.moves.push({
              type: selectedMove.type,
              position: selectedMove.position,
              secret: false,
              double: false,
              role: 'culprit',
            });
          }
        }
      }

      // Simulate detective moves
      const detectives = simulatedState.players.filter(p => p.role !== 'culprit');
      const mrXPositions = culprit
        ? [culprit.position]
        : this.getPossibleCulpritPositions(simulatedState, map).map(m => m.position);
      for (const detective of detectives) {
        if (detective.role === player.role) continue;
        const move = getNextDetectiveMove(map, detective, mrXPositions, detectives.filter(d => d.role !== detective.role));
        if (move) {
          detective.position = move;
          detective.taxiTickets -= 1; // Simplified: assume taxi for simulation
          simulatedState.moves.push({
            type: 'taxi',
            position: move,
            secret: false,
            double: false,
            role: detective.role,
          });
        }
      }

      // Check if Mr. X is caught
      const culpritPos = culprit?.position;
      if (culpritPos && detectives.some(d => d.position === culpritPos)) {
        return player.role === 'culprit' ? -100 : 100; // Reward for catching, penalty for being caught
      }
    }

    // Evaluate final state
    return this.evaluateState(simulatedState, player, map);
  }

  private evaluateState(gameState: GameState, player: Player, map: Map<number, NodeConnections>): number {
    const culprit = gameState.players.find(p => p.role === 'culprit');
    const detectives = gameState.players.filter(p => p.role !== 'culprit');

    if (!culprit) return 0;

    // Score based on proximity and exits
    const minDistance = Math.min(
      ...detectives.map(d => this.calculateDistance(d.position, culprit.position))
    );
    const exitCount = this.getExitCount(map, culprit.position);

    if (player.role === 'culprit') {
      return minDistance + exitCount * 5; // Higher score for distance and escapes
    } else {
      return -minDistance + (exitCount === 0 ? 50 : 0); // Reward for closeness and blocking
    }
  }

  private cloneGameState(gameState: GameState): GameState {
    return {
      ...gameState,
      players: gameState.players.map(p => ({ ...p })),
      moves: [...gameState.moves],
    };
  }
}
