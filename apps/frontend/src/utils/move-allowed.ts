import { MoveType } from '@yard/shared-utils';
import { mapData } from '../app/game/board-data/grid_map';
import { MapNode } from '../stores/use-nodes-store';

export const isMoveAllowed = (
  nodeId: number,
  runnerPosition: number | undefined,
  currentType: MoveType,
  isSecret: boolean,
): boolean => {

  const nodes: MapNode[] = mapData.nodes;
  const node = nodes.find((node) => node.id === runnerPosition);
  if (!node) {
    return false;
  }
  const availableMoves = isSecret ?
    [...(node.taxi || []), ...(node.bus || []), ...(node.underground || []), ...(node.river || [])] :
    node[currentType] || [];

  return availableMoves.includes(nodeId);
};
