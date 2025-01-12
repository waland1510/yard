import { MapNode } from '../stores/use-nodes-store';
import { mapData } from '../app/grid_map';

export const isMoveAllowed = (
  nodeId: number,
  runnerPosition: number | undefined,
  currentType: 'taxi' | 'bus' | 'underground' | 'river' | 'secret' | 'double',
): boolean => {

console.log('isMoveAllowed', nodeId, runnerPosition, currentType);

  const nodes: MapNode[] = mapData.nodes;

  // Find the available moves based on the runner's current position and type
  const availableMoves =
    nodes.find((node) => node.id === runnerPosition)?.[currentType] || [];

  // Check if the given nodeId is in the list of available moves
  return availableMoves.includes(nodeId);
};
