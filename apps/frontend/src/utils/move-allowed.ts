import { RoleType } from '@yard/shared-utils';
import { mapData } from '../app/game/board-data/grid_map';
import { MapNode } from '../stores/use-nodes-store';

const nodes: MapNode[] = mapData.nodes;
export const isMoveAllowed = (
  nodeId: number,
  runnerPosition: number | undefined,
  currentRole: RoleType | undefined,
): string | undefined => {

  const node = nodes.find((node) => node.id === runnerPosition);
  if (!node) {
    return undefined;
  }
  if (currentRole === 'culprit' && node.river?.includes(nodeId)) {
    return 'blue';
  }
  if (node.underground?.includes(nodeId)) {
    return 'red';
  }
  if (node.bus?.includes(nodeId)) {
    return 'green';
  }
  if (node.taxi?.includes(nodeId)) {
    return 'orange';
  }

  return undefined;
};
