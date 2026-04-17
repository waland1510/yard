import { GameState, mapData, Move, Player, showCulpritAtMoves } from '@yard/shared-utils';

/**
 * Smarter fallback move: move toward the last known culprit position
 * (or away from detectives if playing as culprit).
 */
export function decideLocalMove(gameState: GameState, player: Player): Move {
  const currentNode = mapData.nodes.find(node => node.id === player.position);

  if (!currentNode) {
    throw new Error('Current node not found in map data');
  }

  const possibleMoves: Array<{ type: 'taxi' | 'bus' | 'underground'; position: number }> = [];

  if (currentNode.taxi && player.taxiTickets > 0) {
    currentNode.taxi.forEach(targetPosition => {
      possibleMoves.push({ type: 'taxi', position: targetPosition });
    });
  }

  if (currentNode.bus && player.busTickets > 0) {
    currentNode.bus.forEach(targetPosition => {
      possibleMoves.push({ type: 'bus', position: targetPosition });
    });
  }

  if (currentNode.underground && player.undergroundTickets > 0) {
    currentNode.underground.forEach(targetPosition => {
      possibleMoves.push({ type: 'underground', position: targetPosition });
    });
  }

  if (possibleMoves.length === 0) {
    throw new Error('No possible moves available');
  }

  if (player.role === 'culprit') {
    // Culprit: move to the position farthest from all detectives
    const detectives = gameState.players.filter(p => p.role !== 'culprit');
    return possibleMoves.reduce((best, move) => {
      const minDist = Math.min(...detectives.map(d => manhattanDist(move.position, d.position)));
      const bestDist = Math.min(...detectives.map(d => manhattanDist(best.position, d.position)));
      return minDist > bestDist ? move : best;
    }, possibleMoves[0]);
  } else {
    // Detective: move toward last known or predicted culprit position
    const culpritMoves = gameState.moves.filter(m => m.role === 'culprit');
    const numCulpritMoves = culpritMoves.length;
    const lastRevealedIdx = [...culpritMoves.keys()]
      .reverse()
      .find(i => showCulpritAtMoves.includes(i + 1));
    const targetPosition = lastRevealedIdx !== undefined
      ? culpritMoves[lastRevealedIdx].position
      : null;

    if (targetPosition !== null) {
      return possibleMoves.reduce((best, move) => {
        const distA = manhattanDist(move.position, targetPosition);
        const distB = manhattanDist(best.position, targetPosition);
        return distA < distB ? move : best;
      }, possibleMoves[0]);
    }

    // No info yet — pick the move with the most connections (transport hub)
    return possibleMoves.reduce((best, move) => {
      const moveNode = mapData.nodes.find(n => n.id === move.position);
      const bestNode = mapData.nodes.find(n => n.id === best.position);
      const moveConns = (moveNode?.taxi?.length ?? 0) + (moveNode?.bus?.length ?? 0) + (moveNode?.underground?.length ?? 0);
      const bestConns = (bestNode?.taxi?.length ?? 0) + (bestNode?.bus?.length ?? 0) + (bestNode?.underground?.length ?? 0);
      return moveConns > bestConns ? move : best;
    }, possibleMoves[0]);
  }
}

function manhattanDist(pos1: number, pos2: number): number {
  const n1 = mapData.nodes.find(n => n.id === pos1);
  const n2 = mapData.nodes.find(n => n.id === pos2);
  if (!n1 || !n2) return 999;
  return Math.abs(n1.x - n2.x) + Math.abs(n1.y - n2.y);
}

