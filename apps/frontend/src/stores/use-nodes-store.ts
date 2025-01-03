import { create } from 'zustand';
import { mapData } from '../app/grid_map';

export interface Node {
    id: number;
    taxi: number[];
    bus?: number[];
    underground?: number[];
    river?: number[];
    x: number;
    y: number;
}

interface NodesState {
    nodes: Node[];
    getNode: (nodeId: number) => Node | undefined;
}


export const useNodesStore = create<NodesState>((set, get) => ({
    nodes: mapData.nodes,
    getNode: (nodeId) => get().nodes.find(node => node.id === nodeId),
}));
