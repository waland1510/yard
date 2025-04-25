import { GameState, mapData, Move, Player } from '@yard/shared-utils';

export function decideLocalMove(gameState: GameState, player: Player): Move {
  const currentNode = mapData.nodes.find(node => node.id === player.position);

  if (!currentNode) {
    throw new Error('Current node not found in map data');
  }

  const possibleMoves = [];

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

  return possibleMoves[0]; // Simplified logic to pick the first move
}
