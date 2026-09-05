import { mapData } from "./grid-map";

export function areMovesBidirectional(): boolean {
  console.log("Starting bidirectional move check...");

  const nodeMap = new Map(mapData.nodes.map(node => [node.id, node]));

  const transports = ['taxi', 'bus', 'underground', 'river'] as const;

  for (const node of mapData.nodes) {
    for (const transport of transports) {
      const connections = node[transport];
      if (!Array.isArray(connections)) continue;

      for (const connectedNodeId of connections) {
        const connectedNode = nodeMap.get(connectedNodeId);
        if (!connectedNode || !connectedNode[transport]?.includes(node.id)) {
          console.error(`Reverse connection missing: Node ${node.id} -> ${connectedNodeId} via ${transport}`);
          return false; // Reverse connection is missing
        }
      }
    }
  }

  console.log("All moves are bidirectional.");
  return true;
}
areMovesBidirectional();
