import { describe, expect, it } from "vitest";
import type { AnchorPoint, NodeLayout } from "../layout/types";
import { snapAnchorToNode, snapNodeHorizontalAnchorX } from "./anchorSnap";

const node: NodeLayout = {
  id: "node-a",
  x: 100,
  y: 40,
  width: 80,
  height: 60,
};

describe("snapNodeHorizontalAnchorX", () => {
  it("snaps top and bottom anchors in 10px increments relative to the node center", () => {
    expect(snapNodeHorizontalAnchorX(node, 107)).toBe(110);
    expect(snapNodeHorizontalAnchorX(node, 116)).toBe(120);
    expect(snapNodeHorizontalAnchorX(node, 146)).toBe(150);
  });

  it("clamps snapped anchor positions to the node bounds", () => {
    expect(snapNodeHorizontalAnchorX(node, 98)).toBe(100);
    expect(snapNodeHorizontalAnchorX(node, 183)).toBe(180);
  });
});

describe("snapAnchorToNode", () => {
  it("re-snaps horizontal anchors relative to the attached node center", () => {
    const anchor: AnchorPoint = { x: 107, y: 40, side: "top", ordinal: 0 };

    expect(snapAnchorToNode(anchor, node)).toEqual({ x: 110, y: 40, side: "top", ordinal: 0 });
  });

  it("keeps vertical anchors on the global 10px grid", () => {
    const anchor: AnchorPoint = { x: 180, y: 77, side: "right", ordinal: 0 };

    expect(snapAnchorToNode(anchor, node)).toEqual({ x: 180, y: 80, side: "right", ordinal: 0 });
  });
});
