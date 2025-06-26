/* eslint-disable @typescript-eslint/no-unused-vars */
import { GameState, Move, Player, MoveType, mapData, Node, showCulpritAtMoves, PredictedCulpritMove } from '@yard/shared-utils';
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
    console.log(`[AI Decision] Using enhanced AI logic for ${player.role}`);
    return this.calculateEnhancedAIMove(gameState, player);
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
          moveDetails.score = this.calculateMoveScore(player, targetPosition, gameState, map, detectives);
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
    // Use enhanced tracking for better predictions
    return this.getAdvancedCulpritPositions(gameState, map);
  }

  private getAdvancedCulpritPositions(
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

    // Enhanced tracking with human behavior analysis
    const humanBehaviorProfile = this.analyzeHumanBehaviorProfile(culpritMoves, gameState);
    const movementPattern = this.detectMovementPattern(culpritMoves);
    const riskAssessment = this.assessCurrentRisk(gameState);

    // Initialize with the last known position
    let positionProbs: Map<number, { prob: number; type: MoveType | null }> = new Map([
      [lastRevealedPosition, { prob: 1.0, type: null }],
    ]);

    // Simulate moves from last revealed to current
    for (let i = lastRevealedMoveIndex; i < currentMoveNumber; i++) {
      const newPositionProbs = new Map<number, { prob: number; type: MoveType | null }>();
      const totalWeight = Array.from(positionProbs.values()).reduce((sum, entry) => sum + entry.prob, 0);

      // Analyze transport pattern for smarter predictions
      const transportPattern = this.analyzeTransportPattern(culpritMoves);
      const lastMove = culpritMoves[i - 1];

      for (const [position, { prob }] of positionProbs) {
        const node = map.get(position);
        if (!node) continue;

        // Available transports based on tickets with weighted probabilities
        const transports: { type: MoveType; connections: number[]; weight: number }[] = [];

        if (culprit.taxiTickets > 0 || culprit.secretTickets > 0) {
          const weight = this.getTransportWeight('taxi', transportPattern, lastMove, node);
          transports.push({ type: 'taxi', connections: node.taxi || [], weight });
        }
        if (culprit.busTickets > 0 || culprit.secretTickets > 0) {
          const weight = this.getTransportWeight('bus', transportPattern, lastMove, node);
          transports.push({ type: 'bus', connections: node.bus || [], weight });
        }
        if (culprit.undergroundTickets > 0 || culprit.secretTickets > 0) {
          const weight = this.getTransportWeight('underground', transportPattern, lastMove, node);
          transports.push({ type: 'underground', connections: node.underground || [], weight });
        }

        // Calculate total weighted connections
        const totalWeightedConnections = transports.reduce((sum, t) => sum + (t.connections.length * t.weight), 0);
        if (totalWeightedConnections === 0) continue;

        for (const { type, connections, weight } of transports) {
          for (const next of connections) {
            const positionWeight = this.calculateEnhancedPositionWeight(
              next,
              gameState,
              map,
              humanBehaviorProfile,
              movementPattern,
              riskAssessment
            );
            const transportWeight = weight;
            const moveProb = (prob * connections.length * transportWeight / totalWeightedConnections) * positionWeight;

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
      (node.taxi?.length ?? 0) +
      (node.bus?.length ?? 0) +
      (node.underground?.length ?? 0)
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

  private calculateEnhancedAIMove(gameState: GameState, player: Player): Move {
    try {
      if (player.role === 'culprit') {
        return this.calculateLocalAIMove(gameState, player);
      } else {
        return this.calculateEnhancedDetectiveMove(gameState, player);
      }
    } catch (error) {
      console.error(`[Enhanced AI] Error for ${player.role}:`, error);
      return this.calculateLocalAIMove(gameState, player);
    }
  }

  private calculateEnhancedDetectiveMove(gameState: GameState, player: Player): Move {
    try {
      const currentNode = mapData.nodes.find(node => node.id === player.position);
      if (!currentNode) {
        throw new Error(`Current node not found for position ${player.position}`);
      }

      const detectives = gameState.players.filter(p => p.role !== 'culprit');
      const otherDetectives = detectives.filter(d => d.role !== player.role);
      const culpritMoves = gameState.moves.filter(m => m.role === 'culprit');
      const moveNumber = culpritMoves.length;

      // Assess human player skill and adjust difficulty
      const skillAssessment = this.assessHumanPlayerSkill(gameState);
      const difficultyLevel = this.calculateAdaptiveDifficulty(skillAssessment, gameState);

      // Get enhanced possible culprit positions with human behavior patterns
      const possibleCulpritPositions = this.getEnhancedCulpritPositions(gameState);

      // Analyze game phase and adjust strategy
      const gamePhase = this.determineGamePhase(gameState);

      // Get all possible moves with enhanced scoring
      const possibleMovesWithDetails = this.getEnhancedPossibleMoves(
        currentNode,
        player,
        gameState,
        possibleCulpritPositions,
        gamePhase
      );

      if (possibleMovesWithDetails.length === 0) {
        throw new Error('No possible moves available');
      }

      // Apply advanced coordination and strategic filtering with difficulty adjustment
      const coordinatedMoves = this.applyAdvancedCoordination(
        possibleMovesWithDetails,
        player,
        otherDetectives,
        possibleCulpritPositions,
        gamePhase
      );

      // Apply difficulty scaling to moves
      const difficultyAdjustedMoves = this.applyDifficultyScaling(
        coordinatedMoves,
        difficultyLevel,
        skillAssessment
      );

      // Select best move with enhanced decision making
      const selectedMove = this.selectOptimalDetectiveMove(
        difficultyAdjustedMoves,
        player,
        gameState,
        gamePhase
      );

      // Create the move object with enhanced special ticket logic
      const move: Move = {
        type: selectedMove.type,
        position: selectedMove.targetPosition,
        secret: false, // Detectives don't use secret tickets
        double: this.shouldDetectiveUseDoubleTicket(selectedMove, player, gameState, gamePhase),
        role: player.role
      };

      console.log(`[Enhanced Detective AI] ${player.role} selected move: ${move.type} to position ${move.position} (score: ${selectedMove.score}, phase: ${gamePhase})`);
      return move;

    } catch (error) {
      console.error(`[Enhanced Detective AI] Error for ${player.role}:`, error);
      return this.calculateLocalAIMove(gameState, player);
    }
  }

  private calculateLocalAIMove(gameState: GameState, player: Player): Move {
    try {
      const currentNode = mapData.nodes.find(node => node.id === player.position);

      if (!currentNode) {
        throw new Error(`Current node not found for position ${player.position}`);
      }

      // Get all possible moves with detailed analysis
      const possibleMovesWithDetails = this.getPossibleMovesWithDetails(currentNode, player, gameState);

      if (possibleMovesWithDetails.length === 0) {
        throw new Error('No possible moves available');
      }

      // Sort moves by score (highest first)
      possibleMovesWithDetails.sort((a, b) => b.score - a.score);

      // Filter out moves blocked by other players unless it's the only option
      const unblockedMoves = possibleMovesWithDetails.filter(move => move.blockedBy.length === 0);
      const bestMoves = unblockedMoves.length > 0 ? unblockedMoves : possibleMovesWithDetails;

      // Select the best move
      const selectedMove = bestMoves[0];

      // Create the move object
      const move: Move = {
        type: selectedMove.type,
        position: selectedMove.targetPosition,
        secret: this.shouldUseSecretTicket(selectedMove, player, gameState),
        double: this.shouldUseDoubleTicket({
          type: selectedMove.type,
          position: selectedMove.targetPosition,
          secret: false,
          double: false,
          role: player.role
        }, player, gameState),
        role: player.role
      };

      console.log(`[Local AI] ${player.role} selected move: ${move.type} to position ${move.position} (score: ${selectedMove.score})`);

      return move;
    } catch (error) {
      console.error(`[Local AI] Error in calculateLocalAIMove for ${player.role}:`, error);
      // Fallback to basic local logic
      return decideLocalMove(gameState, player);
    }
  }

  private shouldUseSecretTicket(move: { type: MoveType; targetPosition: number; score: number }, player: Player, gameState: GameState): boolean {
    // Only culprit has secret tickets
    if (player.role !== 'culprit' || !player.secretTickets || player.secretTickets <= 0) {
      return false;
    }

    // Use secret ticket if it significantly improves the position or in critical situations
    const currentMoveNumber = gameState.moves.filter(m => m.role === 'culprit').length;
    const detectives = gameState.players.filter(p => p.role !== 'culprit');

    // Use secret ticket if any detective is very close (within 1 hop)
    const tooClose = detectives.some(detective =>
      this.calculateDistance(move.targetPosition, detective.position) <= 1
    );

    // Use secret ticket strategically every few moves to confuse detectives
    const strategicUse = currentMoveNumber > 0 && currentMoveNumber % 4 === 0;

    // Save secret tickets for later in the game unless in immediate danger
    const lateGame = currentMoveNumber > 10;

    return tooClose || (strategicUse && lateGame);
  }

  private calculateDynamicRole(
    player: Player,
    otherDetectives: Player[],
    possibleCulpritPositions: (number | PredictedCulpritMove)[],
    map: Map<number, NodeConnections>
  ): 'primary-hunter' | 'interceptor' | 'flanker' {
    // Get base role from standard assignment
    const baseRole = this.getDetectiveRole(player, otherDetectives);

    // If there's only one detective, always be primary hunter
    if (otherDetectives.length === 0) return 'primary-hunter';

    // Calculate position relative to culprit centroid
    const culpritCentroid = this.calculateCulpritCentroid(possibleCulpritPositions);
    const playerX = player.position % 100;
    const playerY = Math.floor(player.position / 100);
    const distanceToCentroid = Math.sqrt(
      Math.pow(playerX - culpritCentroid.x, 2) +
      Math.pow(playerY - culpritCentroid.y, 2)
    );

    // Get nearby transport hubs
    const currentNode = map.get(player.position);
    const hasUnderground = currentNode?.underground?.length || 0;
    const hasBus = currentNode?.bus?.length || 0;

    // Check if we're already in a good position for a specific role
    if (hasUnderground > 0 || hasBus > 1) {
      // Well positioned for interception
      return 'interceptor';
    }

    // Calculate angles to other detectives relative to culprit
    const detectiveAngles = otherDetectives.map(detective => {
      const detX = detective.position % 100;
      const detY = Math.floor(detective.position / 100);
      return Math.atan2(detY - culpritCentroid.y, detX - culpritCentroid.x);
    });

    const playerAngle = Math.atan2(playerY - culpritCentroid.y, playerX - culpritCentroid.x);
    const hasGoodFlankingAngle = detectiveAngles.every(angle => {
      let angleDiff = Math.abs(playerAngle - angle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      return angleDiff >= Math.PI / 3; // At least 60 degrees apart
    });

    // Adapt role based on position and situation
    if (distanceToCentroid <= 2 && baseRole !== 'primary-hunter') {
      // If very close to culprit, become primary hunter
      return 'primary-hunter';
    } else if (hasGoodFlankingAngle && baseRole !== 'flanker') {
      // If in good flanking position, become flanker
      return 'flanker';
    }

    // Fall back to base role if no better adaptation found
    return baseRole;
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

  private calculateMoveScore(
    player: Player,
    targetPosition: number,
    gameState: GameState,
    map: Map<number, NodeConnections>,
    detectives: Player[]
  ): number {
    let score = 0;

    if (player.role !== 'culprit') {
      const currentMoveNumber = gameState.moves.filter(move => move.role === 'culprit').length;

      // Early game positioning strategy (first 3 moves)
      if (currentMoveNumber <= 3) {
        const targetNode = map.get(targetPosition);
        if (!targetNode) return -100;

        const hasUnderground = targetNode.underground?.length || 0;

        switch (currentMoveNumber) {
          case 1: {
            // Move 1: Get close to underground but not on it
            const nearbyNodes = Array.from(map.entries())
              .filter(([pos, node]) => {
                if (node.underground?.length) {
                  const distance = this.calculateDistance(pos, targetPosition);
                  return distance === 1; // One move away from underground
                }
                return false;
              });

            if (nearbyNodes.length > 0) {
              score += 50; // High bonus for positioning near underground
            }

            // Penalty for being directly on underground in first move
            if (hasUnderground) {
              score -= 30;
            }
            break;
          }

          case 2: {
            // Move 2: Get on underground station
            if (hasUnderground) {
              score += 75; // Very high bonus for reaching underground
            } else {
              // Check if we can reach underground in next move if we take this position
              const canReachUnderground = Array.from(map.entries())
                .some(([pos, node]) => {
                  if (node.underground?.length) {
                    const distance = this.calculateDistance(pos, targetPosition);
                    return distance === 1;
                  }
                  return false;
                });

              if (canReachUnderground) {
                score += 25; // Bonus for being one move away from underground
              } else {
                score -= 40; // Penalty for positions that don't enable underground access
              }
            }
            break;
          }

          case 3: {
            // Move 3: Use underground strategically
            if (hasUnderground) {
              // Calculate how well this underground station is positioned relative to likely culprit locations
              const possibleCulpritPositions = this.getPossibleCulpritPositions(gameState, map);
              const avgDistanceToCulprit = possibleCulpritPositions.reduce((sum, pos) => {
                const distance = this.calculateDistance(targetPosition, typeof pos === 'number' ? pos : pos.position);
                const weight = typeof pos === 'number' ? 1 : pos.probability;
                return sum + (distance * weight);
              }, 0) / possibleCulpritPositions.length;

              // Prefer underground stations that are well-positioned for pursuit
              score += (15 - avgDistanceToCulprit) * 5;
            }
            break;
          }
        }

        // Global early-game coordination
        const otherDetectives = detectives.filter(d => d.role !== player.role);
        const detectiveSpacing = Math.min(...otherDetectives.map(d =>
          this.calculateDistance(targetPosition, d.position)
        ));

        // Maintain spacing in early game
        if (detectiveSpacing < 2) {
          score -= 35; // Strong penalty for clustering in early game
        } else if (detectiveSpacing >= 2 && detectiveSpacing <= 4) {
          score += 15; // Bonus for good spacing
        }
      }

      // Continue with normal scoring for later turns
      // Culprit scoring logic
    } else {
      // Culprit strategy: maximize distance from detectives, prefer escape routes
      const detectiveDistances = detectives.map(d => this.calculateDistance(targetPosition, d.position));
      const minDetectiveDistance = Math.min(...detectiveDistances);

      // Higher score for being farther from detectives
      score += minDetectiveDistance * 5;

      // Bonus for positions with more escape routes
      const exitCount = this.getExitCount(map, targetPosition);
      score += exitCount * 3;

      // Bonus for avoiding bottlenecks unless it's strategic
      if (!this.isBottleneck(map, targetPosition)) {
        score += 5;
      }

      // Penalty for positions recently visited by detectives
      const recentDetectivePositions = new Set(
        gameState.moves
          .filter(m => m.role !== 'culprit')
          .slice(-6)
          .map(m => m.position)
      );
      if (recentDetectivePositions.has(targetPosition)) {
        score -= 10;
      }
    }

    return score;
  }

  private calculateStrategicValue(
    position: number,
    possibleCulpritPositions: (number | PredictedCulpritMove)[],
    map: Map<number, NodeConnections>
  ): number {
    let strategicValue = 0;

    // Check if this position controls important transit routes
    const isBottleneck = this.isBottleneck(map, position);
    if (isBottleneck) {
      strategicValue += 8; // Higher value for controlling bottlenecks
    }

    // Check if this position blocks common escape routes from culprit positions
    for (const culpritPos of possibleCulpritPositions) {
      const actualPos = typeof culpritPos === 'number' ? culpritPos : culpritPos.position;
      const culpritNode = map.get(actualPos);

      if (culpritNode) {
        const allExits = [
          ...(culpritNode.taxi || []),
          ...(culpritNode.bus || []),
          ...(culpritNode.underground || [])
        ];

        if (allExits.includes(position)) {
          // This position directly blocks an escape route
          strategicValue += 12;
        }

        // Check if this position is on key routes away from the culprit
        const distance = this.calculateDistance(position, actualPos);
        if (distance === 2 || distance === 3) {
          // Good intercepting distance
          strategicValue += 4;
        }
      }
    }

    return strategicValue;
  }

  private calculateSurroundingBonus(
    position: number,
    possibleCulpritPositions: (number | PredictedCulpritMove)[],
    detectives: Player[],
    map: Map<number, NodeConnections>
  ): number {
    let bonus = 0;

    // Calculate how well this position contributes to surrounding the culprit
    for (const culpritPos of possibleCulpritPositions) {
      const actualPos = typeof culpritPos === 'number' ? culpritPos : culpritPos.position;
      const weight = typeof culpritPos === 'number' ? 1 : culpritPos.probability;

      const culpritNode = map.get(actualPos);
      if (!culpritNode) continue;

      // Count how many escape routes would be blocked by detectives if this move is made
      const allCulpritExits = [
        ...(culpritNode.taxi || []),
        ...(culpritNode.bus || []),
        ...(culpritNode.underground || [])
      ];

      const uniqueExits = [...new Set(allCulpritExits)];
      const detectivePositions = new Set([position, ...detectives.map(d => d.position)]);

      const blockedExits = uniqueExits.filter(exit => detectivePositions.has(exit));
      const blockedPercentage = blockedExits.length / uniqueExits.length;

      // Higher bonus for higher percentage of blocked exits
      bonus += blockedPercentage * 15 * weight;

      // Extra bonus if this move would create a complete surrounding (all exits blocked)
      if (blockedPercentage >= 0.8) {
        bonus += 25 * weight; // Big bonus for near-complete surrounding
      }
    }

    return bonus;
  }

  private calculateTicketEfficiency(player: Player): number {
    // Prefer using more abundant tickets when available
    const totalTickets = player.taxiTickets + player.busTickets + player.undergroundTickets;

    if (totalTickets === 0) return -10; // Penalty for no tickets

    // Small bonus for having tickets left
    return Math.min(totalTickets, 5);
  }

  private calculateTransportAwareScore(
    targetPosition: number,
    possibleCulpritPositions: (number | PredictedCulpritMove)[],
    gameState: GameState,
    map: Map<number, NodeConnections>
  ): number {
    let score = 0;

    // Get the last culprit moves to understand transport patterns
    const culpritMoves = gameState.moves.filter(m => m.role === 'culprit');
    const lastCulpritMove = culpritMoves[culpritMoves.length - 1];
    const secondLastMove = culpritMoves[culpritMoves.length - 2];

    if (!lastCulpritMove) return 0;

    // Analyze the culprit's transport preferences and predict likely next moves
    const transportPattern = this.analyzeTransportPattern(culpritMoves);
    const targetNode = map.get(targetPosition);

    if (!targetNode) return 0;

    // Bonus for positions that match the predicted transport type
    for (const culpritPos of possibleCulpritPositions) {
      const actualPos = typeof culpritPos === 'number' ? culpritPos : culpritPos.position;
      const weight = typeof culpritPos === 'number' ? 1 : culpritPos.probability;
      const predictedTransport = this.predictLikelyTransportType(actualPos, lastCulpritMove, transportPattern, map);

      // If this detective position can intercept the predicted transport type
      if (this.canInterceptTransportType(targetPosition, actualPos, predictedTransport, map)) {
        score += 15 * weight; // High bonus for transport-aware positioning
      }

      // Special bonus for underground station interception
      if (lastCulpritMove.type === 'underground' && targetNode.underground) {
        // If culprit used underground, prioritize detective moves to underground stations
        const distanceToLastKnownPos = this.calculateDistance(targetPosition, lastCulpritMove.position);
        if (distanceToLastKnownPos <= 4) { // Within reasonable underground range
          score += 20 * weight;
        }
      }

      // Bus route prediction
      if (lastCulpritMove.type === 'bus' && targetNode.bus) {
        // If culprit used bus, detectives should consider bus routes
        score += 12 * weight;
      }

      // Taxi network positioning
      if (lastCulpritMove.type === 'taxi' && targetNode.taxi) {
        // Taxi is most common, less predictive but still relevant for short-range pursuit
        score += 8 * weight;
      }
    }

    // Bonus for positions that block multiple transport types (transport hubs)
    const transportTypes = [
      targetNode.taxi?.length || 0,
      targetNode.bus?.length || 0,
      targetNode.underground?.length || 0
    ].filter(count => count > 0).length;

    if (transportTypes >= 2) {
      score += 10; // Bonus for controlling transport hubs
    }

    // Penalty for repeated transport type if culprit is varying their strategy
    if (this.isCulpritVaryingTransport(culpritMoves) && lastCulpritMove && secondLastMove) {
      if (lastCulpritMove.type === secondLastMove.type) {
        // Culprit is being predictable, detectives should exploit this
        score += 8;
      }
    }

    return score;
  }

  private getTransportWeight(
    transportType: MoveType,
    transportPattern: { [key in MoveType]?: number },
    lastMove: Move | undefined,
    currentNode: NodeConnections
  ): number {
    let weight = 1.0; // Base weight

    // Increase weight if this transport type has been used recently
    const patternWeight = transportPattern[transportType] || 0;
    weight += patternWeight * 0.3;

    // Special logic for transport continuity
    if (lastMove && lastMove.type === transportType) {
      switch (transportType) {
        case 'underground':
          // If last move was underground and current position has underground, highly likely to continue
          if (currentNode.underground && currentNode.underground.length > 0) {
            weight += 2.0;
          }
          break;
        case 'bus':
          // Bus routes are strategic, if culprit used bus last time, moderate chance to continue
          if (currentNode.bus && currentNode.bus.length > 0) {
            weight += 1.5;
          }
          break;
        case 'taxi':
          // Taxi is common, less predictive but still relevant
          weight += 0.5;
          break;
      }
    }

    // Boost weight based on transport availability and strategic value
    switch (transportType) {
      case 'underground':
        // Underground is fastest but limited - high strategic value
        weight += (currentNode.underground?.length || 0) * 0.4;
        break;
      case 'bus':
        // Bus has good coverage - medium strategic value
        weight += (currentNode.bus?.length || 0) * 0.3;
        break;
      case 'taxi':
        // Taxi is everywhere but limited range - lower strategic value but high availability
        weight += (currentNode.taxi?.length || 0) * 0.1;
        break;
    }

    return weight;
  }

  private analyzeTransportPattern(culpritMoves: Move[]): { [key in MoveType]?: number } {
    const pattern: { [key in MoveType]?: number } = {};
    const recentMoves = culpritMoves.slice(-5); // Look at last 5 moves

    recentMoves.forEach(move => {
      if (move.type && !move.secret) { // Don't count secret moves in pattern
        pattern[move.type] = (pattern[move.type] || 0) + 1;
      }
    });

    return pattern;
  }

  private predictLikelyTransportType(
    culpritPosition: number,
    lastMove: Move,
    transportPattern: { [key in MoveType]?: number },
    map: Map<number, NodeConnections>
  ): MoveType | null {
    const culpritNode = map.get(culpritPosition);
    if (!culpritNode) return null;

    // If last move was underground and culprit is at underground station, likely to continue underground
    if (lastMove.type === 'underground' && culpritNode.underground?.length) {
      return 'underground';
    }

    // Check transport pattern preferences
    const mostUsedTransport = Object.entries(transportPattern)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];

    if (mostUsedTransport && mostUsedTransport[1] > 1) {
      return mostUsedTransport[0] as MoveType;
    }

    // Default prediction based on available options
    if (culpritNode.underground?.length) return 'underground';
    if (culpritNode.bus?.length) return 'bus';
    return 'taxi';
  }

  private canInterceptTransportType(
    detectivePosition: number,
    culpritPosition: number,
    transportType: MoveType | null,
    map: Map<number, NodeConnections>
  ): boolean {
    if (!transportType) return false;

    const culpritNode = map.get(culpritPosition);
    const detectiveNode = map.get(detectivePosition);

    if (!culpritNode || !detectiveNode) return false;

    // Get possible destinations for culprit using predicted transport
    let culpritDestinations: number[] = [];
    switch (transportType) {
      case 'underground':
        culpritDestinations = culpritNode.underground || [];
        break;
      case 'bus':
        culpritDestinations = culpritNode.bus || [];
        break;
      case 'taxi':
        culpritDestinations = culpritNode.taxi || [];
        break;
    }

    // Check if detective can reach any of these destinations in 1-2 moves
    for (const destination of culpritDestinations) {
      const distance = this.calculateDistance(detectivePosition, destination);
      if (distance <= 2) {
        return true; // Detective can intercept
      }
    }

    return false;
  }

  private isCulpritVaryingTransport(culpritMoves: Move[]): boolean {
    const recentMoves = culpritMoves.slice(-4).filter(m => !m.secret);
    if (recentMoves.length < 3) return false;

    const transportTypes = new Set(recentMoves.map(m => m.type));
    return transportTypes.size >= 2; // Using at least 2 different transport types
  }

  private calculateAdvancedCoordination(
    player: Player,
    targetPosition: number,
    possibleCulpritPositions: (number | PredictedCulpritMove)[],
    otherDetectives: Player[],
    map: Map<number, NodeConnections>
  ): number {
    let score = 0;

    if (otherDetectives.length === 0) return 0;

    // Get detective role with dynamic adaptation
    const detectiveRole = this.calculateDynamicRole(player, otherDetectives, possibleCulpritPositions, map);

    // Calculate culprit centroid for strategic positioning
    const culpritCentroid = this.calculateCulpritCentroid(possibleCulpritPositions);

    // Global anti-clustering - applied to all roles
    const minDistanceToOthers = Math.min(
      ...otherDetectives.map(d => this.calculateDistance(targetPosition, d.position))
    );

    // Progressive clustering penalty based on distance and number of nearby detectives
    const nearbyDetectives = otherDetectives.filter(d =>
      this.calculateDistance(targetPosition, d.position) <= 3
    ).length;

    // Exponential penalty for multiple nearby detectives
    if (nearbyDetectives > 0) {
      score -= Math.pow(2, nearbyDetectives) * 10;
    }

    // Role-specific strategies
    switch (detectiveRole) {
      case 'primary-hunter': {
        // Primary hunter: aggressively pursue closest culprit position
        const closestCulpritDistance = Math.min(
          ...possibleCulpritPositions.map(pos => {
            const actualPos = typeof pos === 'number' ? pos : pos.position;
            return this.calculateDistance(targetPosition, actualPos);
          })
        );

        // Strong bonus for being close to culprit
        score += (10 - Math.min(closestCulpritDistance, 10)) * 4;

        // Additional clustering penalty for primary hunter
        if (minDistanceToOthers < 2) {
          score -= 30; // Severe clustering penalty
        }
        break;
      }

      case 'interceptor': {
        // Interceptor: control transport hubs and cut off escape routes
        const transportConnections = this.getExitCount(map, targetPosition);
        score += transportConnections * 3;

        // Calculate optimal intercept position
        const avgCulpritDistance = possibleCulpritPositions.reduce((sum: number, pos) => {
          const actualPos = typeof pos === 'number' ? pos : pos.position;
          const weight = typeof pos === 'number' ? 1 : pos.probability;
          return sum + (this.calculateDistance(targetPosition, actualPos) * weight);
        }, 0) as number/ possibleCulpritPositions.length;

        // Sweet spot for interception (2-4 moves from predicted positions)
        if (avgCulpritDistance >= 2 && avgCulpritDistance <= 4) {
          score += 15;
        }

        // Maintain spacing from primary hunter
        const primaryHunter = otherDetectives.find(d =>
          this.getDetectiveRole(d, otherDetectives.filter(od => od !== d)) === 'primary-hunter'
        );
        if (primaryHunter) {
          const distanceToPrimary = this.calculateDistance(targetPosition, primaryHunter.position);
          // Ideal spacing from primary hunter
          if (distanceToPrimary >= 3 && distanceToPrimary <= 5) {
            score += 10;
          }
        }
        break;
      }

      case 'flanker': {
        // Flanker: approach from unexpected angles
        const approachAngleScore = this.calculateFlankingScore(
          targetPosition,
          culpritCentroid,
          otherDetectives
        );
        score += approachAngleScore;

        // Cover gaps in detective coverage
        const coverageScore = this.calculateCoverageGapScore(
          targetPosition,
          possibleCulpritPositions,
          otherDetectives
        );
        score += coverageScore * 1.5; // Increased emphasis on gap coverage

        // Maintain flanking distance
        const avgDistanceToOthers = otherDetectives.reduce(
          (sum, d) => sum + this.calculateDistance(targetPosition, d.position),
          0
        ) / otherDetectives.length;

        // Reward positions that maintain good flanking distance
        if (avgDistanceToOthers >= 3 && avgDistanceToOthers <= 5) {
          score += 12;
        }
        break;
      }
    }

    // Global coordination bonuses
    const convergenceScore = this.calculateConvergenceScore(
      targetPosition,
      possibleCulpritPositions,
      otherDetectives
    );
    score += convergenceScore;

    const collectiveBlockingScore = this.calculateCollectiveBlocking(
      targetPosition,
      possibleCulpritPositions,
      otherDetectives,
      map
    );
    score += collectiveBlockingScore;

    // Priority zone scoring
    const priorityZone = this.calculatePriorityZone(culpritCentroid, detectiveRole, otherDetectives, map);
    const priorityZoneScore = this.calculatePriorityZoneScore(targetPosition, priorityZone);
    score += priorityZoneScore;

    return score;
  }

  private calculatePriorityZone(
    culpritCentroid: { x: number; y: number },
    detectiveRole: 'primary-hunter' | 'interceptor' | 'flanker',
    otherDetectives: Player[],
    map: Map<number, NodeConnections>
  ): { center: { x: number; y: number }; radius: number } {
    // Base priority zone depends on role
    switch (detectiveRole) {
      case 'primary-hunter': {
        // Find nearby transport hubs to the culprit
        const culpritNode = map.get(Math.floor(culpritCentroid.x + culpritCentroid.y * 100));
        const hasNearbyTransport = culpritNode && (
          culpritNode.underground?.length > 0 ||
          culpritNode.bus?.length > 0
        );

        // Adjust radius based on transport availability
        return {
          center: culpritCentroid,
          radius: hasNearbyTransport ? 1.5 : 2 // Tighter radius if transport nearby
        };
      }

      case 'interceptor': {
        const otherPositions = otherDetectives.map(d => ({
          x: d.position % 100,
          y: Math.floor(d.position / 100)
        }));

        // Calculate average detective position
        const avgDetX = otherPositions.reduce((sum, pos) => sum + pos.x, 0) / otherPositions.length;
        const avgDetY = otherPositions.reduce((sum, pos) => sum + pos.y, 0) / otherPositions.length;

        // Project likely escape direction (away from average detective position)
        const escapeVectorX = culpritCentroid.x - avgDetX;
        const escapeVectorY = culpritCentroid.y - avgDetY;
        const vectorLength = Math.sqrt(escapeVectorX * escapeVectorX + escapeVectorY * escapeVectorY);

        // Find transport hubs in projected escape direction
        const projectedPos = {
          x: culpritCentroid.x + (escapeVectorX / vectorLength) * 3,
          y: culpritCentroid.y + (escapeVectorY / vectorLength) * 3
        };

        const nearbyNodes = Array.from(map.entries())
          .filter(([pos, _]) => {
            const nodeX = pos % 100;
            const nodeY = Math.floor(pos / 100);
            const dx = nodeX - projectedPos.x;
            const dy = nodeY - projectedPos.y;
            return Math.sqrt(dx * dx + dy * dy) <= 3;
          })
          .map(([_, node]) => node);

        const transportHubCount = nearbyNodes.reduce((count, node) =>
          count + (node.underground?.length || 0) + (node.bus?.length || 0), 0);

        return {
          center: {
            x: projectedPos.x,
            y: projectedPos.y
          },
          // Larger radius if many transport options available
          radius: 2 + Math.min(2, transportHubCount * 0.5)
        };
      }

      case 'flanker': {
        // Find the primary hunter or most aggressive detective
        const primaryHunter = otherDetectives.find(d =>
          this.calculateDynamicRole(
            d,
            otherDetectives.filter(od => od !== d),
            [{ type: 'taxi', position: Math.floor(culpritCentroid.x + culpritCentroid.y * 100), probability: 1 }],
            map
          ) === 'primary-hunter'
        );

        if (primaryHunter) {
          const pursuitVectorX = culpritCentroid.x - (primaryHunter.position % 100);
          const pursuitVectorY = culpritCentroid.y - Math.floor(primaryHunter.position / 100);
          const vectorLength = Math.sqrt(pursuitVectorX * pursuitVectorX + pursuitVectorY * pursuitVectorY);

          // Calculate perpendicular vector and normalize
          const perpX = -pursuitVectorY / vectorLength;
          const perpY = pursuitVectorX / vectorLength;

          // Check both potential flanking positions and choose the one with better transport access
          const leftFlank = {
            x: culpritCentroid.x + perpX * 3,
            y: culpritCentroid.y + perpY * 3
          };

          const rightFlank = {
            x: culpritCentroid.x - perpX * 3,
            y: culpritCentroid.y - perpY * 3
          };

          // Score each flank based on transport availability
          const scoreFlank = (pos: { x: number; y: number }) => {
            const nearby = Array.from(map.entries())
              .filter(([nodePos, _]) => {
                const dx = (nodePos % 100) - pos.x;
                const dy = Math.floor(nodePos / 100) - pos.y;
                return Math.sqrt(dx * dx + dy * dy) <= 2;
              })
              .map(([_, node]) => node);

            return nearby.reduce((score, node) =>
              score + (node.underground?.length || 0) * 2 + (node.bus?.length || 0), 0);
          };

          const leftScore = scoreFlank(leftFlank);
          const rightScore = scoreFlank(rightFlank);

          return {
            center: leftScore >= rightScore ? leftFlank : rightFlank,
            radius: 3
          };
        }

        // Fallback if no primary hunter found - choose side with better transport
        return {
          center: {
            x: culpritCentroid.x + 3,
            y: culpritCentroid.y + 3
          },
          radius: 4
        };
      }
    }
  }

  private calculatePriorityZoneScore(
    targetPosition: number,
    priorityZone: { center: { x: number; y: number }; radius: number }
  ): number {
    const targetX = targetPosition % 100;
    const targetY = Math.floor(targetPosition / 100);

    // Calculate distance from target to priority zone center
    const distanceToCenter = Math.sqrt(
      Math.pow(targetX - priorityZone.center.x, 2) +
      Math.pow(targetY - priorityZone.center.y, 2)
    );

    // Score based on distance to priority zone center
    if (distanceToCenter <= priorityZone.radius) {
      // Inside priority zone - maximum score scaling down to edge
      const normalizedDistance = distanceToCenter / priorityZone.radius;
      const baseScore = 20 * (1 - normalizedDistance);

      // Bonus for being very close to center for primary hunter
      if (normalizedDistance < 0.3) {
        return baseScore + 10;
      }
      return baseScore;
    } else {
      // Outside priority zone - penalty increasing with distance
      const distanceOutside = distanceToCenter - priorityZone.radius;
      return Math.max(-20, -5 * Math.pow(distanceOutside, 1.5));
    }
  }

  private getDetectiveRole(player: Player, otherDetectives: Player[]): 'primary-hunter' | 'interceptor' | 'flanker' {
    if (otherDetectives.length === 0) return 'primary-hunter';

    // Find the closest detective to the current one
    const closestDetective = otherDetectives.reduce((closest, detective) => {
      const distance = this.calculateDistance(player.position, detective.position);
      if (!closest || distance < closest.distance) {
        return { detective, distance };
      }
      return closest;
    }, null as { detective: Player; distance: number } | null);

    // If no closest detective found, be primary hunter
    if (!closestDetective) return 'primary-hunter';

    // If very close to another detective, become flanker to spread out
    if (closestDetective.distance <= 2) {
      return 'flanker';
    }

    // Check if we're near transport hubs
    const currentNode = mapData.nodes.find(node => node.id === player.position);
    if (currentNode?.underground?.length || (currentNode?.bus?.length || 0) > 1) {
      return 'interceptor';
    }

    // Default to primary hunter
    return 'primary-hunter';
  }

  private calculateFlankingScore(
    targetPosition: number,
    culpritCentroid: { x: number; y: number },
    otherDetectives: Player[]
  ): number {
    const targetX = targetPosition % 100;
    const targetY = Math.floor(targetPosition / 100);

    // Calculate angle from target to culprit centroid
    const targetAngle = Math.atan2(targetY - culpritCentroid.y, targetX - culpritCentroid.x);

    // Calculate angles from other detectives to culprit
    const otherAngles = otherDetectives.map(detective => {
      const detX = detective.position % 100;
      const detY = Math.floor(detective.position / 100);
      return Math.atan2(detY - culpritCentroid.y, detX - culpritCentroid.x);
    });

    // Score based on how well this position complements other angles
    let score = 0;
    otherAngles.forEach(angle => {
      let angleDiff = Math.abs(targetAngle - angle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      // Maximum score for angles around 90-120 degrees (good flanking angles)
      if (angleDiff >= Math.PI / 2 && angleDiff <= 2 * Math.PI / 3) {
        score += 15;
      }
    });

    return score;
  }

  private calculateCoverageGapScore(
    targetPosition: number,
    possibleCulpritPositions: (number | PredictedCulpritMove)[],
    otherDetectives: Player[]
  ): number {
    let score = 0;

    // Calculate center of mass for detective positions
    const otherPositions = otherDetectives.map(d => ({
      x: d.position % 100,
      y: Math.floor(d.position / 100)
    }));

    const centerX = otherPositions.reduce((sum, pos) => sum + pos.x, 0) / otherPositions.length;
    const centerY = otherPositions.reduce((sum, pos) => sum + pos.y, 0) / otherPositions.length;

    // For each possible culprit position, check if this position helps cover gaps
    possibleCulpritPositions.forEach(pos => {
      const culpritPos = typeof pos === 'number' ? pos : pos.position;
      const weight = typeof pos === 'number' ? 1 : pos.probability;
      const culpritX = culpritPos % 100;
      const culpritY = Math.floor(culpritPos / 100);

      // Vector from detective center to culprit
      const vectorX = culpritX - centerX;
      const vectorY = culpritY - centerY;

      // Position relative to this vector
      const targetX = targetPosition % 100;
      const targetY = Math.floor(targetPosition / 100);

      // Calculate perpendicular distance to escape vector
      const perpDistance = Math.abs(
        vectorX * (centerY - targetY) - (centerX - targetX) * vectorY
      ) / Math.sqrt(vectorX * vectorX + vectorY * vectorY);

      // Score higher for positions that help form a containment net
      if (perpDistance >= 2 && perpDistance <= 4) {
        score += 10 * weight;
      }
    });

    return score;
  }

  private calculateConvergenceScore(
    targetPosition: number,
    possibleCulpritPositions: (number | PredictedCulpritMove)[],
    otherDetectives: Player[]
  ): number {
    let score = 0;

    possibleCulpritPositions.forEach(pos => {
      const culpritPos = typeof pos === 'number' ? pos : pos.position;
      const weight = typeof pos === 'number' ? 1 : pos.probability;

      // Vector from target to culprit
      const targetX = targetPosition % 100;
      const targetY = Math.floor(targetPosition / 100);
      const culpritX = culpritPos % 100;
      const culpritY = Math.floor(culpritPos / 100);

      // Calculate convergence angle with other detectives
      otherDetectives.forEach(detective => {
        const detX = detective.position % 100;
        const detY = Math.floor(detective.position / 100);

        // Vectors to culprit
        const v1x = culpritX - targetX;
        const v1y = culpritY - targetY;
        const v2x = culpritX - detX;
        const v2y = culpritY - detY;

        // Calculate angle between vectors
        const dotProduct = v1x * v2x + v1y * v2y;
        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
        const angle = Math.acos(dotProduct / (mag1 * mag2));

        // Best convergence at angles between 60-120 degrees
        if (angle >= Math.PI / 3 && angle <= 2 * Math.PI / 3) {
          score += 12 * weight;
        }
      });
    });

    return score;
  }

  private calculateCollectiveBlocking(
    targetPosition: number,
    possibleCulpritPositions: (number | PredictedCulpritMove)[],
    otherDetectives: Player[],
    map: Map<number, NodeConnections>
  ): number {
    let score = 0;

    // For each possible culprit position
    possibleCulpritPositions.forEach(pos => {
      const culpritPos = typeof pos === 'number' ? pos : pos.position;
      const weight = typeof pos === 'number' ? 1 : pos.probability;

      const culpritNode = map.get(culpritPos);
      if (!culpritNode) return;

      // Get all possible escape routes from culprit position
      const escapeRoutes = [
        ...(culpritNode.taxi || []),
        ...(culpritNode.bus || []),
        ...(culpritNode.underground || [])
      ];

      // Calculate how many escape routes are blocked by this position and other detectives
      const blockedRoutes = escapeRoutes.filter(route => {
        if (route === targetPosition) return true;
        return otherDetectives.some(d => d.position === route);
      });

      // Score based on percentage of blocked routes
      const blockingPercentage = blockedRoutes.length / escapeRoutes.length;
      score += blockingPercentage * 20 * weight;

      // Extra bonus for blocking key transport types
      if (culpritNode.underground && blockedRoutes.some(route => culpritNode.underground?.includes(route))) {
        score += 15 * weight; // High priority for blocking underground routes
      }
      if (culpritNode.bus && blockedRoutes.some(route => culpritNode.bus?.includes(route))) {
        score += 10 * weight; // Medium priority for blocking bus routes
      }
    });

    return score;
  }

  private getEnhancedCulpritPositions(gameState: GameState): PredictedCulpritMove[] {
    const map = new Map<number, NodeConnections>();
    mapData.nodes.forEach(node => {
      map.set(node.id, {
        taxi: node.taxi || [],
        bus: node.bus || [],
        underground: node.underground || []
      });
    });
    const basePredictions = this.getPossibleCulpritPositions(gameState, map);

    if (basePredictions.length === 0) {
      return [];
    }

    // Enhance predictions with human behavior patterns
    const culpritMoves = gameState.moves.filter(m => m.role === 'culprit');
    const detectives = gameState.players.filter(p => p.role !== 'culprit');

    return basePredictions.map(prediction => {
      let adjustedProbability = prediction.probability;

      // Human players tend to avoid positions very close to detectives
      const minDetectiveDistance = Math.min(
        ...detectives.map(d => this.calculateDistance(prediction.position, d.position))
      );

      if (minDetectiveDistance <= 1) {
        adjustedProbability *= 0.3; // Much less likely for humans to stay very close
      } else if (minDetectiveDistance <= 2) {
        adjustedProbability *= 0.6; // Somewhat less likely
      } else if (minDetectiveDistance >= 5) {
        adjustedProbability *= 1.2; // Humans prefer safer distances
      }

      // Human players often prefer positions with multiple escape routes
      const exitCount = this.getExitCount(map, prediction.position);
      if (exitCount >= 4) {
        adjustedProbability *= 1.15;
      } else if (exitCount <= 2) {
        adjustedProbability *= 0.85;
      }

      // Humans tend to vary their transport types
      const recentMoves = culpritMoves.slice(-3);
      const recentTypes = new Set(recentMoves.filter(m => !m.secret).map(m => m.type));
      if (recentTypes.size >= 2 && prediction.type !== 'underground') {
        adjustedProbability *= 1.1; // Slight preference for continuing variation
      }

      return {
        ...prediction,
        probability: Math.max(0.01, Math.min(1.0, adjustedProbability))
      };
    });
  }

  private determineGamePhase(gameState: GameState): 'early' | 'mid' | 'late' | 'endgame' {
    const culpritMoves = gameState.moves.filter(m => m.role === 'culprit').length;

    if (culpritMoves <= 3) return 'early';
    if (culpritMoves <= 8) return 'mid';
    if (culpritMoves <= 18) return 'late';
    return 'endgame';
  }

  private getEnhancedPossibleMoves(
    currentNode: Node | undefined,
    player: Player,
    gameState: GameState,
    possibleCulpritPositions: PredictedCulpritMove[],
    gamePhase: 'early' | 'mid' | 'late' | 'endgame'
  ): Array<{ type: MoveType; targetPosition: number; score: number; blockedBy: string[] }> {
    const baseMoves = this.getPossibleMovesWithDetails(currentNode, player, gameState);

    return baseMoves.map(move => {
      let enhancedScore = move.score;

      // Phase-specific scoring adjustments
      switch (gamePhase) {
        case 'early':
          enhancedScore += this.calculateEarlyGameScore(move, player, gameState);
          break;
        case 'mid':
          enhancedScore += this.calculateMidGameScore(move, player, possibleCulpritPositions);
          break;
        case 'late':
          enhancedScore += this.calculateLateGameScore(move, player, possibleCulpritPositions);
          break;
        case 'endgame':
          enhancedScore += this.calculateEndGameScore(move, player, possibleCulpritPositions);
          break;
      }

      // Add human behavior prediction bonus
      enhancedScore += this.calculateHumanBehaviorScore(move, gameState, possibleCulpritPositions);

      return {
        ...move,
        score: enhancedScore
      };
    });
  }

  private calculateEarlyGameScore(
    move: { type: MoveType; targetPosition: number },
    player: Player,
    gameState: GameState
  ): number {
    let score = 0;
    const detectives = gameState.players.filter(p => p.role !== 'culprit');
    const otherDetectives = detectives.filter(d => d.role !== player.role);

    // Early game: focus on spreading out and positioning
    const minDistanceToOthers = Math.min(
      ...otherDetectives.map(d => this.calculateDistance(move.targetPosition, d.position))
    );

    // Strong bonus for maintaining good spacing
    if (minDistanceToOthers >= 3 && minDistanceToOthers <= 5) {
      score += 20;
    } else if (minDistanceToOthers < 2) {
      score -= 30; // Heavy penalty for clustering
    }

    // Bonus for reaching strategic positions (underground stations, transport hubs)
    const map = new Map<number, NodeConnections>();
    mapData.nodes.forEach(node => {
      map.set(node.id, {
        taxi: node.taxi || [],
        bus: node.bus || [],
        underground: node.underground || []
      });
    });

    const targetNode = map.get(move.targetPosition);
    if (targetNode?.underground && targetNode.underground.length > 0) {
      score += 15; // Underground stations are valuable in early game
    }

    const totalConnections = (targetNode?.taxi?.length || 0) +
                           (targetNode?.bus?.length || 0) +
                           (targetNode?.underground?.length || 0);
    if (totalConnections >= 4) {
      score += 10; // Transport hubs are good for mobility
    }

    return score;
  }

  private calculateMidGameScore(
    move: { type: MoveType; targetPosition: number },
    player: Player,
    possibleCulpritPositions: PredictedCulpritMove[]
  ): number {
    let score = 0;

    // Mid game: balance between pursuit and positioning
    if (possibleCulpritPositions.length > 0) {
      const avgDistanceToCulprit = possibleCulpritPositions.reduce((sum, pos) => {
        const distance = this.calculateDistance(move.targetPosition, pos.position);
        return sum + (distance * pos.probability);
      }, 0);

      // Optimal distance for mid-game positioning (2-4 moves away)
      if (avgDistanceToCulprit >= 2 && avgDistanceToCulprit <= 4) {
        score += 25;
      } else if (avgDistanceToCulprit > 6) {
        score -= 15; // Too far away
      }

      // Bonus for cutting off high-probability escape routes
      const highProbPositions = possibleCulpritPositions.filter(p => p.probability > 0.3);
      const blockedRoutes = highProbPositions.filter(pos =>
        this.calculateDistance(move.targetPosition, pos.position) <= 2
      ).length;

      score += blockedRoutes * 8;
    }

    return score;
  }

  private calculateLateGameScore(
    move: { type: MoveType; targetPosition: number },
    player: Player,
    possibleCulpritPositions: PredictedCulpritMove[]
  ): number {
    let score = 0;

    // Late game: aggressive pursuit and area denial
    if (possibleCulpritPositions.length > 0) {
      const closestCulpritDistance = Math.min(
        ...possibleCulpritPositions.map(pos => this.calculateDistance(move.targetPosition, pos.position))
      );

      // Strong bonus for being close to culprit
      score += (8 - Math.min(closestCulpritDistance, 8)) * 6;

      // Bonus for positions that can reach multiple culprit positions
      const reachablePositions = possibleCulpritPositions.filter(pos =>
        this.calculateDistance(move.targetPosition, pos.position) <= 2
      ).length;

      score += reachablePositions * 12;

      // Penalty for ticket conservation issues
      const totalTickets = player.taxiTickets + player.busTickets + player.undergroundTickets;
      if (totalTickets <= 3) {
        // Prefer cheaper moves when low on tickets
        if (move.type === 'taxi') score += 5;
        if (move.type === 'underground') score -= 8;
      }
    }

    return score;
  }

  private calculateEndGameScore(
    move: { type: MoveType; targetPosition: number },
    player: Player,
    possibleCulpritPositions: PredictedCulpritMove[]
  ): number {
    let score = 0;

    // Endgame: all-out pursuit, ignore everything else
    if (possibleCulpritPositions.length > 0) {
      const weightedDistance = possibleCulpritPositions.reduce((sum, pos) => {
        const distance = this.calculateDistance(move.targetPosition, pos.position);
        return sum + (distance * pos.probability);
      }, 0);

      // Massive bonus for being very close
      score += (10 - Math.min(weightedDistance, 10)) * 15;

      // Huge bonus for positions that can directly catch culprit
      const canCatchPositions = possibleCulpritPositions.filter(pos =>
        this.calculateDistance(move.targetPosition, pos.position) <= 1
      );

      score += canCatchPositions.length * 50;

      // Don't worry about tickets in endgame - go for the win
      if (move.type === 'underground' && canCatchPositions.length > 0) {
        score += 20; // Use underground if it helps catch culprit
      }
    }

    return score;
  }

  private calculateHumanBehaviorScore(
    move: { type: MoveType; targetPosition: number },
    gameState: GameState,
    possibleCulpritPositions: PredictedCulpritMove[]
  ): number {
    let score = 0;

    // Predict human culprit behavior patterns
    const culpritMoves = gameState.moves.filter(m => m.role === 'culprit');

    if (culpritMoves.length >= 3) {
      // Analyze recent movement patterns
      const recentMoves = culpritMoves.slice(-3);
      const recentPositions = recentMoves.map(m => m.position);

      // Check if culprit is moving in a pattern (linear, circular, etc.)
      const isLinearMovement = this.detectLinearMovement(recentPositions);
      const isCircularMovement = this.detectCircularMovement(recentPositions);

      if (isLinearMovement) {
        // Predict continuation of linear movement and intercept
        const predictedNextPosition = this.predictLinearNextPosition(recentPositions);
        if (predictedNextPosition && this.calculateDistance(move.targetPosition, predictedNextPosition) <= 2) {
          score += 25;
        }
      }

      if (isCircularMovement) {
        // Position to cut off circular movement
        const centerPosition = this.calculateMovementCenter(recentPositions);
        if (centerPosition && this.calculateDistance(move.targetPosition, centerPosition) <= 3) {
          score += 20;
        }
      }

      // Human players often avoid recently visited areas
      const recentDetectivePositions = new Set(
        gameState.moves
          .filter(m => m.role !== 'culprit')
          .slice(-4)
          .map(m => m.position)
      );

      // Bonus for moving to areas culprit might think are "safe"
      if (!recentDetectivePositions.has(move.targetPosition)) {
        score += 8;
      }
    }

    return score;
  }

  private detectLinearMovement(positions: number[]): boolean {
    if (positions.length < 3) return false;

    // Check if positions form a roughly linear pattern
    const vectors = [];
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      vectors.push({
        dx: (curr % 100) - (prev % 100),
        dy: Math.floor(curr / 100) - Math.floor(prev / 100)
      });
    }

    // Check if vectors are roughly in the same direction
    if (vectors.length < 2) return false;

    const firstVector = vectors[0];
    const firstMagnitude = Math.sqrt(firstVector.dx * firstVector.dx + firstVector.dy * firstVector.dy);
    if (firstMagnitude === 0) return false;

    for (let i = 1; i < vectors.length; i++) {
      const vector = vectors[i];
      const magnitude = Math.sqrt(vector.dx * vector.dx + vector.dy * vector.dy);
      if (magnitude === 0) continue;

      // Calculate dot product to check direction similarity
      const dotProduct = (firstVector.dx * vector.dx + firstVector.dy * vector.dy) / (firstMagnitude * magnitude);
      if (dotProduct < 0.5) return false; // Not similar enough direction
    }

    return true;
  }

  private detectCircularMovement(positions: number[]): boolean {
    if (positions.length < 3) return false;

    // Check if positions form a circular or back-and-forth pattern
    const distances = [];
    const center = this.calculateMovementCenter(positions);
    if (!center) return false;

    for (const pos of positions) {
      const distance = this.calculateDistance(pos, center);
      distances.push(distance);
    }

    // Check if distances from center are roughly similar (circular pattern)
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;

    return variance < 2; // Low variance indicates circular movement
  }

  private predictLinearNextPosition(positions: number[]): number | null {
    if (positions.length < 2) return null;

    const last = positions[positions.length - 1];
    const secondLast = positions[positions.length - 2];

    const dx = (last % 100) - (secondLast % 100);
    const dy = Math.floor(last / 100) - Math.floor(secondLast / 100);

    const predictedX = (last % 100) + dx;
    const predictedY = Math.floor(last / 100) + dy;

    // Ensure predicted position is within map bounds
    if (predictedX < 0 || predictedX >= 100 || predictedY < 0 || predictedY >= 100) {
      return null;
    }

    return predictedY * 100 + predictedX;
  }

  private calculateMovementCenter(positions: number[]): number | null {
    if (positions.length === 0) return null;

    const avgX = positions.reduce((sum, pos) => sum + (pos % 100), 0) / positions.length;
    const avgY = positions.reduce((sum, pos) => sum + Math.floor(pos / 100), 0) / positions.length;

    return Math.floor(avgY) * 100 + Math.floor(avgX);
  }

  private applyAdvancedCoordination(
    moves: Array<{ type: MoveType; targetPosition: number; score: number; blockedBy: string[] }>,
    player: Player,
    otherDetectives: Player[],
    possibleCulpritPositions: PredictedCulpritMove[],
    gamePhase: 'early' | 'mid' | 'late' | 'endgame'
  ): Array<{ type: MoveType; targetPosition: number; score: number; blockedBy: string[] }> {

    return moves.map(move => {
      let coordinationScore = 0;

      // Enhanced role-based coordination
      const map = new Map<number, NodeConnections>();
      mapData.nodes.forEach(node => {
        map.set(node.id, {
          taxi: node.taxi || [],
          bus: node.bus || [],
          underground: node.underground || []
        });
      });
      const detectiveRole = this.calculateDynamicRole(player, otherDetectives, possibleCulpritPositions, map);

      switch (detectiveRole) {
        case 'primary-hunter':
          coordinationScore += this.calculatePrimaryHunterCoordination(move, player, otherDetectives, possibleCulpritPositions);
          break;
        case 'interceptor':
          coordinationScore += this.calculateInterceptorCoordination(move, player, otherDetectives, possibleCulpritPositions);
          break;
        case 'flanker':
          coordinationScore += this.calculateFlankerCoordination(move, player, otherDetectives, possibleCulpritPositions);
          break;
      }

      // Phase-specific coordination adjustments
      coordinationScore += this.calculatePhaseCoordination(move, gamePhase, otherDetectives);

      // Anti-clustering with dynamic spacing based on game phase
      coordinationScore += this.calculateDynamicSpacing(move, player, otherDetectives, gamePhase);

      return {
        ...move,
        score: move.score + coordinationScore
      };
    });
  }

  private selectOptimalDetectiveMove(
    moves: Array<{ type: MoveType; targetPosition: number; score: number; blockedBy: string[] }>,
    player: Player,
    gameState: GameState,
    gamePhase: 'early' | 'mid' | 'late' | 'endgame'
  ): { type: MoveType; targetPosition: number; score: number; blockedBy: string[] } {

    // Filter out blocked moves unless it's endgame
    let availableMoves = moves;
    if (gamePhase !== 'endgame') {
      const unblockedMoves = moves.filter(move => move.blockedBy.length === 0);
      if (unblockedMoves.length > 0) {
        availableMoves = unblockedMoves;
      }
    }

    // Sort by score and apply some randomization to avoid predictability
    availableMoves.sort((a, b) => b.score - a.score);

    // In early/mid game, add some randomization among top moves
    if (gamePhase === 'early' || gamePhase === 'mid') {
      const topMoves = availableMoves.slice(0, Math.min(3, availableMoves.length));
      const scoreThreshold = topMoves[0].score - 10; // Within 10 points of best
      const competitiveMoves = topMoves.filter(move => move.score >= scoreThreshold);

      if (competitiveMoves.length > 1) {
        return competitiveMoves[Math.floor(Math.random() * competitiveMoves.length)];
      }
    }

    return availableMoves[0];
  }

  private shouldDetectiveUseDoubleTicket(
    move: { type: MoveType; targetPosition: number; score: number },
    player: Player,
    gameState: GameState,
    gamePhase: 'early' | 'mid' | 'late' | 'endgame'
  ): boolean {

    if (!player.doubleTickets || player.doubleTickets <= 0) {
      return false;
    }

    // Only use double tickets in late game or endgame when close to culprit
    if (gamePhase === 'early' || gamePhase === 'mid') {
      return false;
    }

    const possibleCulpritPositions = this.getEnhancedCulpritPositions(gameState);
    if (possibleCulpritPositions.length === 0) {
      return false;
    }

    const minDistanceToCulprit = Math.min(
      ...possibleCulpritPositions.map(pos => this.calculateDistance(move.targetPosition, pos.position))
    );

    // Use double ticket if very close to culprit (within 2 moves)
    return minDistanceToCulprit <= 2;
  }

  private calculateCulpritCentroid(
    positions: (number | PredictedCulpritMove)[]
  ): { x: number; y: number } {
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;

    positions.forEach(pos => {
      const position = typeof pos === 'number' ? pos : pos.position;
      const weight = typeof pos === 'number' ? 1 : pos.probability;

      const x = position % 100;
      const y = Math.floor(position / 100);

      weightedX += x * weight;
      weightedY += y * weight;
      totalWeight += weight;
    });

    return {
      x: weightedX / (totalWeight || 1),
      y: weightedY / (totalWeight || 1)
    };
  }

  private calculatePrimaryHunterCoordination(
    move: { type: MoveType; targetPosition: number },
    player: Player,
    otherDetectives: Player[],
    possibleCulpritPositions: PredictedCulpritMove[]
  ): number {
    let score = 0;

    // Primary hunter should be closest to culprit
    if (possibleCulpritPositions.length > 0) {
      const avgDistanceToCulprit = possibleCulpritPositions.reduce((sum, pos) => {
        return sum + (this.calculateDistance(move.targetPosition, pos.position) * pos.probability);
      }, 0);

      // Strong bonus for being close to culprit
      score += (10 - Math.min(avgDistanceToCulprit, 10)) * 8;

      // Ensure other detectives aren't too close to avoid clustering
      const minDistanceToOthers = Math.min(
        ...otherDetectives.map(d => this.calculateDistance(move.targetPosition, d.position))
      );

      if (minDistanceToOthers < 2) {
        score -= 25; // Penalty for clustering
      }
    }

    return score;
  }

  private calculateInterceptorCoordination(
    move: { type: MoveType; targetPosition: number },
    player: Player,
    otherDetectives: Player[],
    possibleCulpritPositions: PredictedCulpritMove[]
  ): number {
    let score = 0;

    // Interceptor should control key transport hubs and cut off escape routes
    const map = new Map<number, NodeConnections>();
    mapData.nodes.forEach(node => {
      map.set(node.id, {
        taxi: node.taxi || [],
        bus: node.bus || [],
        underground: node.underground || []
      });
    });

    const targetNode = map.get(move.targetPosition);
    if (targetNode) {
      // Bonus for positions with many connections (transport hubs)
      const totalConnections = (targetNode.taxi?.length || 0) +
                             (targetNode.bus?.length || 0) +
                             (targetNode.underground?.length || 0);
      score += totalConnections * 3;

      // Special bonus for underground stations
      if (targetNode.underground && targetNode.underground.length > 0) {
        score += 15;
      }
    }

    // Position to intercept culprit escape routes
    if (possibleCulpritPositions.length > 0) {
      const interceptValue = possibleCulpritPositions.reduce((sum, pos) => {
        const distance = this.calculateDistance(move.targetPosition, pos.position);
        // Optimal intercept distance is 2-4 moves
        if (distance >= 2 && distance <= 4) {
          return sum + (pos.probability * 10);
        }
        return sum;
      }, 0);

      score += interceptValue;
    }

    return score;
  }

  private calculateFlankerCoordination(
    move: { type: MoveType; targetPosition: number },
    player: Player,
    otherDetectives: Player[],
    possibleCulpritPositions: PredictedCulpritMove[]
  ): number {
    let score = 0;

    // Flanker should approach from unexpected angles and maintain distance from other detectives
    const minDistanceToOthers = Math.min(
      ...otherDetectives.map(d => this.calculateDistance(move.targetPosition, d.position))
    );

    // Strong bonus for maintaining good spacing
    if (minDistanceToOthers >= 4 && minDistanceToOthers <= 6) {
      score += 20;
    } else if (minDistanceToOthers < 3) {
      score -= 30; // Heavy penalty for being too close
    }

    // Position to approach culprit from different angle than primary hunter
    if (possibleCulpritPositions.length > 0 && otherDetectives.length > 0) {
      const primaryHunter = otherDetectives.find(d =>
        this.getDetectiveRole(d, otherDetectives.filter(od => od !== d)) === 'primary-hunter'
      );

      if (primaryHunter) {
        const culpritCentroid = this.calculateCulpritCentroid(possibleCulpritPositions);

        // Calculate angle difference between flanker and primary hunter relative to culprit
        const hunterAngle = Math.atan2(
          Math.floor(primaryHunter.position / 100) - culpritCentroid.y,
          (primaryHunter.position % 100) - culpritCentroid.x
        );

        const flankerAngle = Math.atan2(
          Math.floor(move.targetPosition / 100) - culpritCentroid.y,
          (move.targetPosition % 100) - culpritCentroid.x
        );

        const angleDiff = Math.abs(hunterAngle - flankerAngle);
        const normalizedAngleDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);

        // Bonus for approaching from different angle (90-180 degrees apart)
        if (normalizedAngleDiff >= Math.PI / 2) {
          score += 15;
        }
      }
    }

    return score;
  }

  private calculatePhaseCoordination(
    move: { type: MoveType; targetPosition: number },
    gamePhase: 'early' | 'mid' | 'late' | 'endgame',
    otherDetectives: Player[]
  ): number {
    let score = 0;

    switch (gamePhase) {
      case 'early':
        // Early game: focus on spreading out
        const earlySpacing = Math.min(
          ...otherDetectives.map(d => this.calculateDistance(move.targetPosition, d.position))
        );
        if (earlySpacing >= 4) score += 15;
        break;

      case 'mid':
        // Mid game: balance between spacing and positioning
        const midSpacing = Math.min(
          ...otherDetectives.map(d => this.calculateDistance(move.targetPosition, d.position))
        );
        if (midSpacing >= 2 && midSpacing <= 4) score += 10;
        break;

      case 'late':
        // Late game: tighten formation but avoid clustering
        const lateSpacing = Math.min(
          ...otherDetectives.map(d => this.calculateDistance(move.targetPosition, d.position))
        );
        if (lateSpacing >= 2 && lateSpacing <= 3) score += 12;
        break;

      case 'endgame':
        // Endgame: coordination less important than catching culprit
        score += 0; // No coordination bonus, focus on pursuit
        break;
    }

    return score;
  }

  private calculateDynamicSpacing(
    move: { type: MoveType; targetPosition: number },
    player: Player,
    otherDetectives: Player[],
    gamePhase: 'early' | 'mid' | 'late' | 'endgame'
  ): number {
    if (otherDetectives.length === 0) return 0;

    let score = 0;
    const distances = otherDetectives.map(d => this.calculateDistance(move.targetPosition, d.position));
    const minDistance = Math.min(...distances);
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    // Dynamic spacing based on game phase
    let optimalMinDistance: number;
    let optimalAvgDistance: number;

    switch (gamePhase) {
      case 'early':
        optimalMinDistance = 4;
        optimalAvgDistance = 6;
        break;
      case 'mid':
        optimalMinDistance = 3;
        optimalAvgDistance = 5;
        break;
      case 'late':
        optimalMinDistance = 2;
        optimalAvgDistance = 4;
        break;
      case 'endgame':
        optimalMinDistance = 1;
        optimalAvgDistance = 3;
        break;
    }

    // Score based on how close to optimal spacing
    const minDistanceScore = 10 - Math.abs(minDistance - optimalMinDistance) * 3;
    const avgDistanceScore = 5 - Math.abs(avgDistance - optimalAvgDistance) * 2;

    score += Math.max(0, minDistanceScore) + Math.max(0, avgDistanceScore);

    // Heavy penalty for clustering (being too close to multiple detectives)
    const nearbyDetectives = distances.filter(d => d <= 2).length;
    if (nearbyDetectives >= 2) {
      score -= 40; // Severe clustering penalty
    }

    return score;
  }

  private analyzeHumanBehaviorProfile(culpritMoves: Move[], gameState: GameState): {
    riskTolerance: 'low' | 'medium' | 'high';
    transportPreference: { taxi: number; bus: number; underground: number };
    patternConsistency: number;
    adaptability: number;
  } {
    const detectives = gameState.players.filter(p => p.role !== 'culprit');

    // Analyze risk tolerance based on distance to detectives
    let totalRisk = 0;
    let riskSamples = 0;

    culpritMoves.forEach((move, index) => {
      if (index > 0) { // Skip first move
        const detectiveDistances = detectives.map(d => {
          // Get detective position at that time (approximate)
          const detectiveMoves = gameState.moves.filter(m => m.role === d.role && gameState.moves.indexOf(m) <= gameState.moves.indexOf(move));
          const lastDetectiveMove = detectiveMoves[detectiveMoves.length - 1];
          return lastDetectiveMove ? this.calculateDistance(move.position, lastDetectiveMove.position) : 10;
        });
        const minDistance = Math.min(...detectiveDistances);
        totalRisk += minDistance;
        riskSamples++;
      }
    });

    const avgRisk = riskSamples > 0 ? totalRisk / riskSamples : 5;
    const riskTolerance = avgRisk < 3 ? 'high' : avgRisk < 5 ? 'medium' : 'low';

    // Analyze transport preferences
    const transportCounts = { taxi: 0, bus: 0, underground: 0 };
    culpritMoves.filter(m => !m.secret).forEach(move => {
      if (move.type && transportCounts.hasOwnProperty(move.type)) {
        transportCounts[move.type]++;
      }
    });

    const totalTransport = Object.values(transportCounts).reduce((sum, count) => sum + count, 0);
    const transportPreference = {
      taxi: totalTransport > 0 ? transportCounts.taxi / totalTransport : 0.33,
      bus: totalTransport > 0 ? transportCounts.bus / totalTransport : 0.33,
      underground: totalTransport > 0 ? transportCounts.underground / totalTransport : 0.33
    };

    // Analyze pattern consistency (how predictable the player is)
    const patternConsistency = this.calculatePatternConsistency(culpritMoves);

    // Analyze adaptability (how much the player changes strategy)
    const adaptability = this.calculateAdaptability(culpritMoves, gameState);

    return {
      riskTolerance,
      transportPreference,
      patternConsistency,
      adaptability
    };
  }

  private detectMovementPattern(culpritMoves: Move[]): {
    type: 'linear' | 'circular' | 'random' | 'hub-based' | 'evasive';
    confidence: number;
    predictedNextPositions: number[];
  } {
    if (culpritMoves.length < 3) {
      return { type: 'random', confidence: 0, predictedNextPositions: [] };
    }

    const positions = culpritMoves.map(m => m.position);

    // Check for linear movement
    const linearConfidence = this.calculateLinearConfidence(positions);

    // Check for circular movement
    const circularConfidence = this.calculateCircularConfidence(positions);

    // Check for hub-based movement (returning to central locations)
    const hubConfidence = this.calculateHubBasedConfidence(positions);

    // Check for evasive movement (avoiding detectives)
    const evasiveConfidence = this.calculateEvasiveConfidence(culpritMoves);

    const patterns = [
      { type: 'linear' as const, confidence: linearConfidence },
      { type: 'circular' as const, confidence: circularConfidence },
      { type: 'hub-based' as const, confidence: hubConfidence },
      { type: 'evasive' as const, confidence: evasiveConfidence }
    ];

    const bestPattern = patterns.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    // Generate predicted next positions based on pattern
    const predictedNextPositions = this.generatePredictedPositions(bestPattern.type, positions);

    return {
      type: bestPattern.confidence > 0.3 ? bestPattern.type : 'random',
      confidence: bestPattern.confidence,
      predictedNextPositions
    };
  }

  private assessCurrentRisk(gameState: GameState): {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    escapeRoutes: number;
  } {
    const culprit = gameState.players.find(p => p.role === 'culprit');
    const detectives = gameState.players.filter(p => p.role !== 'culprit');

    if (!culprit) {
      return { level: 'low', factors: [], escapeRoutes: 0 };
    }

    const factors: string[] = [];
    let riskScore = 0;

    // Distance to closest detective
    const detectiveDistances = detectives.map(d => this.calculateDistance(culprit.position, d.position));
    const minDistance = Math.min(...detectiveDistances);

    if (minDistance <= 1) {
      riskScore += 40;
      factors.push('Detective within 1 move');
    } else if (minDistance <= 2) {
      riskScore += 25;
      factors.push('Detective within 2 moves');
    } else if (minDistance <= 3) {
      riskScore += 10;
      factors.push('Detective within 3 moves');
    }

    // Number of detectives nearby
    const nearbyDetectives = detectiveDistances.filter(d => d <= 3).length;
    if (nearbyDetectives >= 3) {
      riskScore += 20;
      factors.push('Multiple detectives nearby');
    }

    // Ticket situation
    const totalTickets = culprit.taxiTickets + culprit.busTickets + culprit.undergroundTickets;
    if (totalTickets <= 5) {
      riskScore += 15;
      factors.push('Low on tickets');
    }

    // Escape routes
    const map = new Map<number, NodeConnections>();
    mapData.nodes.forEach(node => {
      map.set(node.id, {
        taxi: node.taxi || [],
        bus: node.bus || [],
        underground: node.underground || []
      });
    });

    const escapeRoutes = this.getExitCount(map, culprit.position);
    if (escapeRoutes <= 2) {
      riskScore += 15;
      factors.push('Limited escape routes');
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 50) level = 'critical';
    else if (riskScore >= 30) level = 'high';
    else if (riskScore >= 15) level = 'medium';
    else level = 'low';

    return { level, factors, escapeRoutes };
  }

  private calculateEnhancedPositionWeight(
    position: number,
    gameState: GameState,
    map: Map<number, NodeConnections>,
    humanBehaviorProfile: any,
    movementPattern: any,
    riskAssessment: any
  ): number {
    const baseWeight = this.calculatePositionWeight(position, gameState, map);

    // Adjust based on human behavior profile
    let behaviorMultiplier = 1.0;

    // Risk tolerance adjustment
    const detectives = gameState.players.filter(p => p.role !== 'culprit');
    const minDetectiveDistance = Math.min(
      ...detectives.map(d => this.calculateDistance(position, d.position))
    );

    switch (humanBehaviorProfile.riskTolerance) {
      case 'low':
        if (minDetectiveDistance >= 4) behaviorMultiplier *= 1.3;
        else if (minDetectiveDistance <= 2) behaviorMultiplier *= 0.5;
        break;
      case 'high':
        if (minDetectiveDistance <= 2) behaviorMultiplier *= 1.2;
        else if (minDetectiveDistance >= 5) behaviorMultiplier *= 0.8;
        break;
    }

    // Pattern-based adjustment
    if (movementPattern.type !== 'random' && movementPattern.predictedNextPositions.includes(position)) {
      behaviorMultiplier *= (1 + movementPattern.confidence);
    }

    // Risk assessment adjustment
    if (riskAssessment.level === 'critical' || riskAssessment.level === 'high') {
      // In high risk, prefer positions with more escape routes
      const exitCount = this.getExitCount(map, position);
      if (exitCount >= 4) behaviorMultiplier *= 1.4;
    }

    return baseWeight * behaviorMultiplier;
  }

  private calculatePatternConsistency(culpritMoves: Move[]): number {
    if (culpritMoves.length < 4) return 0;

    // Analyze consistency in transport choices
    const transportSequence = culpritMoves.filter(m => !m.secret).map(m => m.type);
    let consistencyScore = 0;

    // Check for repeated patterns
    for (let patternLength = 2; patternLength <= Math.min(4, transportSequence.length / 2); patternLength++) {
      const pattern = transportSequence.slice(0, patternLength);
      let matches = 0;

      for (let i = patternLength; i <= transportSequence.length - patternLength; i += patternLength) {
        const segment = transportSequence.slice(i, i + patternLength);
        if (JSON.stringify(pattern) === JSON.stringify(segment)) {
          matches++;
        }
      }

      if (matches > 0) {
        consistencyScore += matches / (transportSequence.length / patternLength);
      }
    }

    return Math.min(1, consistencyScore);
  }

  private calculateAdaptability(culpritMoves: Move[], gameState: GameState): number {
    if (culpritMoves.length < 5) return 0.5; // Default medium adaptability

    // Analyze how much the strategy changes over time
    const earlyMoves = culpritMoves.slice(0, Math.floor(culpritMoves.length / 2));
    const lateMoves = culpritMoves.slice(Math.floor(culpritMoves.length / 2));

    // Compare transport usage patterns
    const earlyTransports = this.getTransportDistribution(earlyMoves);
    const lateTransports = this.getTransportDistribution(lateMoves);

    let adaptabilityScore = 0;

    // Calculate difference in transport usage
    Object.keys(earlyTransports).forEach(transport => {
      adaptabilityScore += Math.abs(earlyTransports[transport] - lateTransports[transport]);
    });

    // Analyze position preferences (staying in same areas vs exploring)
    const earlyPositions = new Set(earlyMoves.map(m => Math.floor(m.position / 10))); // Group by area
    const latePositions = new Set(lateMoves.map(m => Math.floor(m.position / 10)));

    const positionOverlap = new Set([...earlyPositions].filter(x => latePositions.has(x))).size;
    const totalAreas = new Set([...earlyPositions, ...latePositions]).size;

    const explorationChange = 1 - (positionOverlap / totalAreas);
    adaptabilityScore += explorationChange;

    return Math.min(1, adaptabilityScore / 2);
  }

  private getTransportDistribution(moves: Move[]): { [key: string]: number } {
    const distribution = { taxi: 0, bus: 0, underground: 0 };
    const validMoves = moves.filter(m => !m.secret && m.type);

    validMoves.forEach(move => {
      if (move.type && distribution.hasOwnProperty(move.type)) {
        distribution[move.type]++;
      }
    });

    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    if (total === 0) return { taxi: 0.33, bus: 0.33, underground: 0.33 };

    Object.keys(distribution).forEach(key => {
      distribution[key] = distribution[key] / total;
    });

    return distribution;
  }

  private calculateLinearConfidence(positions: number[]): number {
    if (positions.length < 3) return 0;

    const vectors = [];
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      vectors.push({
        dx: (curr % 100) - (prev % 100),
        dy: Math.floor(curr / 100) - Math.floor(prev / 100)
      });
    }

    if (vectors.length < 2) return 0;

    let consistentDirections = 0;
    const firstVector = vectors[0];
    const firstMagnitude = Math.sqrt(firstVector.dx * firstVector.dx + firstVector.dy * firstVector.dy);

    if (firstMagnitude === 0) return 0;

    for (let i = 1; i < vectors.length; i++) {
      const vector = vectors[i];
      const magnitude = Math.sqrt(vector.dx * vector.dx + vector.dy * vector.dy);

      if (magnitude === 0) continue;

      const dotProduct = (firstVector.dx * vector.dx + firstVector.dy * vector.dy) / (firstMagnitude * magnitude);
      if (dotProduct > 0.7) { // Similar direction
        consistentDirections++;
      }
    }

    return consistentDirections / (vectors.length - 1);
  }

  private calculateCircularConfidence(positions: number[]): number {
    if (positions.length < 4) return 0;

    const center = this.calculateMovementCenter(positions);
    if (!center) return 0;

    const distances = positions.map(pos => this.calculateDistance(pos, center));
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;

    // Low variance indicates circular movement
    const circularScore = Math.max(0, 1 - variance / 4);

    // Check for returning to similar positions
    const positionRevisits = new Set();
    const revisitScore = positions.reduce((score, pos, index) => {
      const nearbyPositions = positions.slice(0, index).filter(p => this.calculateDistance(pos, p) <= 2);
      if (nearbyPositions.length > 0) {
        positionRevisits.add(pos);
        return score + 1;
      }
      return score;
    }, 0) / positions.length;

    return (circularScore + revisitScore) / 2;
  }

  private calculateHubBasedConfidence(positions: number[]): number {
    if (positions.length < 4) return 0;

    // Find positions that are visited multiple times
    const positionCounts = new Map<number, number>();
    positions.forEach(pos => {
      positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
    });

    const hubs = Array.from(positionCounts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([pos, _]) => pos);

    if (hubs.length === 0) return 0;

    // Calculate how often the player returns to hub areas
    let hubReturns = 0;
    for (let i = 1; i < positions.length; i++) {
      const currentPos = positions[i];
      const isNearHub = hubs.some(hub => this.calculateDistance(currentPos, hub) <= 2);
      if (isNearHub) hubReturns++;
    }

    return hubReturns / (positions.length - 1);
  }

  private calculateEvasiveConfidence(culpritMoves: Move[]): number {
    // This would require detective position history, which is complex
    // For now, return a simple heuristic based on transport variety
    const transportTypes = new Set(culpritMoves.filter(m => !m.secret).map(m => m.type));
    return Math.min(1, transportTypes.size / 3); // More transport variety = more evasive
  }

  private generatePredictedPositions(patternType: string, positions: number[]): number[] {
    switch (patternType) {
      case 'linear':
        const predicted = this.predictLinearNextPosition(positions);
        return predicted ? [predicted] : [];

      case 'circular':
        const center = this.calculateMovementCenter(positions);
        if (!center) return [];
        // Predict positions around the center
        return positions.filter(pos => this.calculateDistance(pos, center) <= 3);

      case 'hub-based':
        // Return hub positions
        const positionCounts = new Map<number, number>();
        positions.forEach(pos => {
          positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
        });
        return Array.from(positionCounts.entries())
          .filter(([_, count]) => count >= 2)
          .map(([pos, _]) => pos);

      default:
        return [];
    }
  }

  private assessHumanPlayerSkill(gameState: GameState): {
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    metrics: {
      averageDistanceFromDetectives: number;
      transportVariety: number;
      escapeEfficiency: number;
      riskManagement: number;
      patternUnpredictability: number;
    };
  } {
    const culpritMoves = gameState.moves.filter(m => m.role === 'culprit');
    const detectives = gameState.players.filter(p => p.role !== 'culprit');

    if (culpritMoves.length < 3) {
      return {
        skillLevel: 'intermediate',
        metrics: {
          averageDistanceFromDetectives: 5,
          transportVariety: 0.5,
          escapeEfficiency: 0.5,
          riskManagement: 0.5,
          patternUnpredictability: 0.5
        }
      };
    }

    // Calculate average distance from detectives
    let totalDistance = 0;
    let distanceSamples = 0;

    culpritMoves.forEach((move, index) => {
      if (index > 0) {
        const detectiveDistances = detectives.map(d => {
          const detectiveMoves = gameState.moves.filter(m => m.role === d.role);
          const relevantMove = detectiveMoves[Math.min(index - 1, detectiveMoves.length - 1)];
          return relevantMove ? this.calculateDistance(move.position, relevantMove.position) : 10;
        });
        const minDistance = Math.min(...detectiveDistances);
        totalDistance += minDistance;
        distanceSamples++;
      }
    });

    const averageDistanceFromDetectives = distanceSamples > 0 ? totalDistance / distanceSamples : 5;

    // Calculate transport variety
    const transportTypes = new Set(culpritMoves.filter(m => !m.secret).map(m => m.type));
    const transportVariety = transportTypes.size / 3; // Max 3 transport types

    // Calculate escape efficiency (how well they use available moves)
    const escapeEfficiency = this.calculateEscapeEfficiency(culpritMoves, gameState);

    // Calculate risk management (avoiding dangerous situations)
    const riskManagement = this.calculateRiskManagement(culpritMoves, gameState);

    // Calculate pattern unpredictability
    const patternUnpredictability = 1 - this.calculatePatternConsistency(culpritMoves);

    const metrics = {
      averageDistanceFromDetectives: Math.min(10, averageDistanceFromDetectives) / 10,
      transportVariety,
      escapeEfficiency,
      riskManagement,
      patternUnpredictability
    };

    // Calculate overall skill level
    const overallScore = (
      metrics.averageDistanceFromDetectives * 0.25 +
      metrics.transportVariety * 0.15 +
      metrics.escapeEfficiency * 0.25 +
      metrics.riskManagement * 0.2 +
      metrics.patternUnpredictability * 0.15
    );

    let skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    if (overallScore >= 0.8) skillLevel = 'expert';
    else if (overallScore >= 0.65) skillLevel = 'advanced';
    else if (overallScore >= 0.4) skillLevel = 'intermediate';
    else skillLevel = 'beginner';

    return { skillLevel, metrics };
  }

  private calculateAdaptiveDifficulty(
    skillAssessment: any,
    gameState: GameState
  ): {
    level: 'easy' | 'normal' | 'hard' | 'expert';
    aggressiveness: number; // 0-1
    coordination: number; // 0-1
    prediction: number; // 0-1
    mistakes: number; // 0-1 (higher = more mistakes)
  } {
    const culpritMoves = gameState.moves.filter(m => m.role === 'culprit').length;
    const gameProgress = Math.min(1, culpritMoves / 20); // Normalize to 0-1

    // Base difficulty on skill assessment
    let baseDifficulty: number;
    switch (skillAssessment.skillLevel) {
      case 'beginner': baseDifficulty = 0.3; break;
      case 'intermediate': baseDifficulty = 0.5; break;
      case 'advanced': baseDifficulty = 0.7; break;
      case 'expert': baseDifficulty = 0.9; break;
    }

    // Adjust difficulty based on game progress (ramp up over time)
    const progressAdjustment = gameProgress * 0.2;
    const adjustedDifficulty = Math.min(1, baseDifficulty + progressAdjustment);

    // Determine difficulty level
    let level: 'easy' | 'normal' | 'hard' | 'expert';
    if (adjustedDifficulty >= 0.8) level = 'expert';
    else if (adjustedDifficulty >= 0.65) level = 'hard';
    else if (adjustedDifficulty >= 0.4) level = 'normal';
    else level = 'easy';

    // Calculate specific parameters
    const aggressiveness = Math.min(1, adjustedDifficulty + 0.1);
    const coordination = Math.min(1, adjustedDifficulty);
    const prediction = Math.min(1, adjustedDifficulty + 0.05);
    const mistakes = Math.max(0, 0.3 - adjustedDifficulty * 0.3); // More mistakes at lower difficulty

    return { level, aggressiveness, coordination, prediction, mistakes };
  }

  private calculateEscapeEfficiency(culpritMoves: Move[], gameState: GameState): number {
    if (culpritMoves.length < 3) return 0.5;

    let efficiencyScore = 0;
    let samples = 0;

    const map = new Map<number, NodeConnections>();
    mapData.nodes.forEach(node => {
      map.set(node.id, {
        taxi: node.taxi || [],
        bus: node.bus || [],
        underground: node.underground || []
      });
    });

    culpritMoves.forEach((move, index) => {
      if (index > 0) {
        const prevPosition = culpritMoves[index - 1].position;
        const currentPosition = move.position;

        // Check if this was an optimal escape move
        const prevNode = map.get(prevPosition);
        if (prevNode) {
          const allPossibleMoves = [
            ...(prevNode.taxi || []),
            ...(prevNode.bus || []),
            ...(prevNode.underground || [])
          ];

          const detectives = gameState.players.filter(p => p.role !== 'culprit');
          const detectiveDistances = allPossibleMoves.map(pos => {
            return Math.min(...detectives.map(d => this.calculateDistance(pos, d.position)));
          });

          const maxDistance = Math.max(...detectiveDistances);
          const actualDistance = Math.min(...detectives.map(d => this.calculateDistance(currentPosition, d.position)));

          if (maxDistance > 0) {
            efficiencyScore += actualDistance / maxDistance;
            samples++;
          }
        }
      }
    });

    return samples > 0 ? efficiencyScore / samples : 0.5;
  }

  private calculateRiskManagement(culpritMoves: Move[], gameState: GameState): number {
    if (culpritMoves.length < 3) return 0.5;

    let riskScore = 0;
    let samples = 0;

    const detectives = gameState.players.filter(p => p.role !== 'culprit');

    culpritMoves.forEach((move, index) => {
      if (index > 0) {
        // Calculate risk level at this position
        const detectiveDistances = detectives.map(d => {
          const detectiveMoves = gameState.moves.filter(m => m.role === d.role);
          const relevantMove = detectiveMoves[Math.min(index - 1, detectiveMoves.length - 1)];
          return relevantMove ? this.calculateDistance(move.position, relevantMove.position) : 10;
        });

        const minDistance = Math.min(...detectiveDistances);
        const nearbyDetectives = detectiveDistances.filter(d => d <= 3).length;

        // Good risk management = maintaining distance and avoiding clusters
        let moveRiskScore = 1;
        if (minDistance <= 1) moveRiskScore = 0.1; // Very risky
        else if (minDistance <= 2) moveRiskScore = 0.3; // Risky
        else if (minDistance <= 3) moveRiskScore = 0.6; // Moderate
        else moveRiskScore = 1; // Safe

        // Penalty for being surrounded
        if (nearbyDetectives >= 3) moveRiskScore *= 0.5;

        riskScore += moveRiskScore;
        samples++;
      }
    });

    return samples > 0 ? riskScore / samples : 0.5;
  }

  private applyDifficultyScaling(
    moves: Array<{ type: MoveType; targetPosition: number; score: number; blockedBy: string[] }>,
    difficultyLevel: any,
    skillAssessment: any
  ): Array<{ type: MoveType; targetPosition: number; score: number; blockedBy: string[] }> {

    return moves.map(move => {
      let adjustedScore = move.score;

      // Apply aggressiveness scaling
      if (move.score > 0) {
        adjustedScore *= difficultyLevel.aggressiveness;
      }

      // Apply coordination scaling (affects coordination bonuses)
      const coordinationBonus = Math.max(0, move.score - 50); // Assume coordination adds 50+ points
      adjustedScore = (adjustedScore - coordinationBonus) + (coordinationBonus * difficultyLevel.coordination);

      // Apply prediction scaling (affects culprit tracking bonuses)
      const predictionBonus = Math.max(0, move.score - 30); // Assume prediction adds 30+ points
      adjustedScore = (adjustedScore - predictionBonus) + (predictionBonus * difficultyLevel.prediction);

      // Add mistakes (random score reduction)
      if (difficultyLevel.mistakes > 0 && Math.random() < difficultyLevel.mistakes) {
        adjustedScore *= (0.7 + Math.random() * 0.3); // Reduce score by 0-30%
      }

      // Skill-based adjustments
      switch (skillAssessment.skillLevel) {
        case 'beginner':
          // Make more obvious moves, less optimal play
          if (move.score < 20) adjustedScore *= 1.2; // Boost simple moves
          break;
        case 'expert':
          // More sophisticated play, better prediction
          if (move.score > 40) adjustedScore *= 1.1; // Boost complex moves
          break;
      }

      return {
        ...move,
        score: adjustedScore
      };
    });
  }
}
