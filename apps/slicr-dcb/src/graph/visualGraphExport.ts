import type {EdgeInput, LaneInput, LayoutResult, NodeInput, SpacingOptions} from 'layout-lib';

export type VisualGraphExportInput = {
  nodes: readonly NodeInput[];
  edges: readonly EdgeInput[];
  lanes: readonly LaneInput[];
  defaults: {nodeWidth: number; nodeHeight: number};
  spacing: SpacingOptions;
  result: LayoutResult;
};

export function serializeVisualGraphAcceptanceTest(input: VisualGraphExportInput): string {
  const request = {
    nodes: input.nodes.map((node) => ({
      id: node.id,
      laneId: node.laneId,
      width: node.width,
      height: node.height,
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      ...(edge.role ? {role: edge.role} : {}),
    })),
    lanes: input.lanes.map((lane) => ({id: lane.id, order: lane.order})),
    defaults: input.defaults,
    spacing: input.spacing,
  };

  return `import {describe, expect, it} from "vitest";
import {compactLayout, type LayoutRequest} from "layout-lib";

describe("compactLayout acceptance: exported visual graph", () => {
  it("reproduces the exported Slicr DCB visual graph", () => {
    const request: LayoutRequest = ${formatObject(request)};

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual(${formatObject(input.result.lanes)});
    expect(result.result.nodes).toEqual(${formatObject(input.result.nodes)});
    expect(result.result.edges).toEqual(${formatObject(input.result.edges)});
  });
});
`;
}

function formatObject(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)":/g, '$1:')
    .replace(/"flow"/g, '"flow"')
    .replace(/"back-reference"/g, '"back-reference"');
}
