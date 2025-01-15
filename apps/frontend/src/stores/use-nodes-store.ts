import { create } from 'zustand';
import { mapData } from '../app/grid_map';

export interface MapNode {
    id: number;
    taxi?: number[];
    bus?: number[];
    underground?: number[];
    river?: number[];
    secret?: boolean;
    double?: boolean;
    x: number;
    y: number;
}

interface NodesState {
    nodes: MapNode[];
    getNode: (nodeId: number) => MapNode | undefined;
}


export const useNodesStore = create<NodesState>((set, get) => ({
    nodes: mapData.nodes,
    getNode: (nodeId) => get().nodes.find(node => node.id === nodeId),
}));
