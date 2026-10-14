import type {NodeInput} from 'layout-lib';

export type NodeType = 'ui' | 'cmd' | 'evt' | 'rm' | 'dm' | 'processor';

export type GraphNode = Required<Pick<NodeInput, 'width' | 'height'>> &
  Pick<NodeInput, 'id' | 'laneId'> & {
    label: string;
    type: NodeType;
  };

export type RenderNode = GraphNode & {
  x: number;
  y: number;
};

export type AddDirection = 'top' | 'right' | 'bottom';

export type Point = {x: number; y: number};
