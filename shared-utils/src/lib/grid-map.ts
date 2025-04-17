export interface Node {
  id: number;
  taxi?: number[];
  bus?: number[];
  underground?: number[];
  river?: number[];
  x: number;
  y: number;
}

export const mapData = {
  nodes: [
    {
      id: 1,
      taxi: [8, 9],
      bus: [58, 46],
      x: 100,
      y: 100
    },
    // Add all other nodes here - for brevity I'm just showing the structure
  ] as Node[]
};
