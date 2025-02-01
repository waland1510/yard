import { MoveType, RoleType } from '@yard/shared-utils';
import { mapData } from '../app/game/board-data/grid_map';
import { MapNode } from '../stores/use-nodes-store';

const nodes: MapNode[] = mapData.nodes;
export const getAvailableType = (
  nodeId: number,
  runnerPosition: number | undefined,
  currentRole: RoleType | undefined,

): MoveType | undefined => {
  const node = nodes.find((node) => node.id === runnerPosition);

  if (!node) {
    return undefined;
  }
  if (currentRole === 'culprit' && node.river?.includes(nodeId)) {
    return 'river';
  }
  if (node.underground?.includes(nodeId)) {
    return 'underground';
  }
  if (node.bus?.includes(nodeId)) {
    return 'bus';
  }
  if (node.taxi?.includes(nodeId)) {
    return 'taxi';
  }

  return undefined;
};
