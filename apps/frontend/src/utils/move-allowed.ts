import { mapData, RoleType } from '@yard/shared-utils';
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
    return '#08f';
  }
  if (node.underground?.includes(nodeId)) {
    return '#d00';
  }
  if (node.bus?.includes(nodeId)) {
    return '#080';
  }
  if (node.taxi?.includes(nodeId)) {
    return '#dd0';
  }

  return undefined;
};
