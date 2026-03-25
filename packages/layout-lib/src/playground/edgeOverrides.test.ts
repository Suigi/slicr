import { describe, expect, it } from "vitest";
import type { EdgeLayout } from "../layout/types";
import { createBaseEdgeOverride } from "./edgeOverrides";

describe("createBaseEdgeOverride", () => {
  it("converts a rendered edge with a moved target node back into base override coordinates", () => {
    const renderedEdge: EdgeLayout = {
      id: "edge-a-b",
      sourceId: "A",
      targetId: "B",
      sourceAnchor: { x: 70, y: 48, side: "bottom", ordinal: 0 },
      targetAnchor: { x: 250, y: 140, side: "top", ordinal: 0 },
      points: [
        { x: 70, y: 48 },
        { x: 70, y: 68 },
        { x: 250, y: 68 },
        { x: 250, y: 140 },
      ],
    };

    const override = createBaseEdgeOverride(renderedEdge, { x: 0, y: 0 }, { x: 100, y: 0 });

    expect(override).toEqual({
      sourceAnchor: { x: 70, y: 48, side: "bottom", ordinal: 0 },
      targetAnchor: { x: 150, y: 140, side: "top", ordinal: 0 },
      points: [
        { x: 70, y: 48 },
        { x: 70, y: 68 },
        { x: 150, y: 68 },
        { x: 150, y: 140 },
      ],
    });
  });

  it("preserves a dragged target-side vertical segment in base coordinates", () => {
    const renderedEdgeAfterDrag: EdgeLayout = {
      id: "edge-a-b",
      sourceId: "A",
      targetId: "B",
      sourceAnchor: { x: 70, y: 48, side: "bottom", ordinal: 0 },
      targetAnchor: { x: 250, y: 140, side: "top", ordinal: 0 },
      points: [
        { x: 70, y: 48 },
        { x: 70, y: 68 },
        { x: 290, y: 68 },
        { x: 250, y: 140 },
      ],
    };

    const override = createBaseEdgeOverride(renderedEdgeAfterDrag, { x: 0, y: 0 }, { x: 100, y: 0 });

    expect(override.points).toEqual([
      { x: 70, y: 48 },
      { x: 70, y: 68 },
      { x: 190, y: 68 },
      { x: 150, y: 140 },
    ]);
  });

  it("handles edges whose source and target nodes have both moved", () => {
    const renderedEdge: EdgeLayout = {
      id: "edge-a-b",
      sourceId: "A",
      targetId: "B",
      sourceAnchor: { x: 100, y: 48, side: "bottom", ordinal: 0 },
      targetAnchor: { x: 250, y: 140, side: "top", ordinal: 0 },
      points: [
        { x: 100, y: 48 },
        { x: 100, y: 68 },
        { x: 250, y: 68 },
        { x: 250, y: 140 },
      ],
    };

    const override = createBaseEdgeOverride(renderedEdge, { x: 30, y: 0 }, { x: 100, y: 0 });

    expect(override.sourceAnchor).toEqual({ x: 70, y: 48, side: "bottom", ordinal: 0 });
    expect(override.targetAnchor).toEqual({ x: 150, y: 140, side: "top", ordinal: 0 });
    expect(override.points).toEqual([
      { x: 70, y: 48 },
      { x: 70, y: 68 },
      { x: 150, y: 68 },
      { x: 150, y: 140 },
    ]);
  });
});
