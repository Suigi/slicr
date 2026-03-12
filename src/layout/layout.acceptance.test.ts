import { describe, expect, it } from "vitest";
import { layout } from "./layout";
import type { LayoutRequest } from "./types";

describe("layout acceptance: minimal A -> B -> C", () => {
  it("lays out 3 nodes across lane-0, lane-1", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-1", laneId: "lane-0", height: 50, width: 120 },
        { id: "node-2", laneId: "lane-1", height: 50 },
        { id: "node-3", laneId: "lane-0", height: 50, width: 120 },
      ],
      edges: [
        { id: "edge-1", sourceId: "node-1", targetId: "node-2" },
        { id: "edge-2", sourceId: "node-2", targetId: "node-3" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
      ],
      defaults: { nodeWidth: 120, nodeHeight: 48 },
      spacing: { minTargetShift: 20, minNodeGap: 40 },
    };

    const result = layout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: -24, bottom: 74 },
      { id: "lane-1", top: 118, bottom: 216 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-1", x: 0, y: 0, width: 120, height: 50 },
      { id: "node-2", x: 100, y: 142, width: 120, height: 50 },
      { id: "node-3", x: 200, y: 0, width: 120, height: 50 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-2",
        sourceAnchor: { x: 70, y: 50, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 150, y: 142, side: "top", ordinal: 0 },
        points: [
          { x: 70, y: 50 },
          { x: 70, y: 70 },
          { x: 150, y: 70 },
          { x: 150, y: 142 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "node-2",
        targetId: "node-3",
        sourceAnchor: { x: 170, y: 142, side: "top", ordinal: 0 },
        targetAnchor: { x: 200, y: 20, side: "left", ordinal: 0 },
        points: [
          { x: 170, y: 142 },
          { x: 170, y: 122 },
          { x: 170, y: 20 },
          { x: 200, y: 20 },
        ],
      },
    ]);
  });

  it("lays out 6 nodes across lane-0, lane-1, lane-2", () => {
    const request: LayoutRequest = {
    nodes: [
      { id: "view-1", laneId: "lane-0", height: 50, width: 120 },
      { id: "command-1", laneId: "lane-1", height: 50 },
      { id: "event-1", laneId: "lane-1" },
      { id: "event-2", laneId: "lane-1" },
      { id: "event-3", laneId: "lane-2" },
      { id: "event-4", laneId: "lane-2" },
    ],
    edges: [
      { id: "edge-1", sourceId: "view-1", targetId: "command-1" },
      { id: "edge-3", sourceId: "event-1", targetId: "view-1" },
      { id: "edge-4", sourceId: "event-2", targetId: "view-1" },
      { id: "edge-2", sourceId: "command-1", targetId: "event-3" },
      { id: "edge-5", sourceId: "command-1", targetId: "event-4" },
    ],
    lanes: [
      { id: "lane-0", order: 0 },
      { id: "lane-1", order: 1 },
      { id: "lane-2", order: 2 },
    ],
    defaults: { nodeWidth: 120, nodeHeight: 48 },
    spacing: { minTargetShift: 20, minNodeGap: 40 },
  };

    const result = layout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: -24, bottom: 74 },
      { id: "lane-1", top: 118, bottom: 216 },
      { id: "lane-2", top: 260, bottom: 356 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "view-1", x: 260, y: 0, width: 120, height: 50 },
      { id: "command-1", x: 350, y: 142, width: 120, height: 50 },
      { id: "event-1", x: 0, y: 142, width: 120, height: 48 },
      { id: "event-2", x: 160, y: 142, width: 120, height: 48 },
      { id: "event-3", x: 440, y: 284, width: 120, height: 48 },
      { id: "event-4", x: 600, y: 284, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "view-1",
        targetId: "command-1",
        sourceAnchor: { x: 330, y: 50, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 400, y: 142, side: "top", ordinal: 0 },
        points: [
          { x: 330, y: 50 },
          { x: 330, y: 70 },
          { x: 400, y: 70 },
          { x: 400, y: 142 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "event-1",
        targetId: "view-1",
        sourceAnchor: { x: 70, y: 142, side: "top", ordinal: 0 },
        targetAnchor: { x: 260, y: 20, side: "left", ordinal: 0 },
        points: [
          { x: 70, y: 142 },
          { x: 70, y: 122 },
          { x: 70, y: 20 },
          { x: 260, y: 20 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "event-2",
        targetId: "view-1",
        sourceAnchor: { x: 230, y: 142, side: "top", ordinal: 0 },
        targetAnchor: { x: 260, y: 30, side: "left", ordinal: 1 },
        points: [
          { x: 230, y: 142 },
          { x: 230, y: 122 },
          { x: 230, y: 30 },
          { x: 260, y: 30 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "command-1",
        targetId: "event-3",
        sourceAnchor: { x: 420, y: 192, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 490, y: 284, side: "top", ordinal: 0 },
        points: [
          { x: 420, y: 192 },
          { x: 420, y: 222 },
          { x: 490, y: 222 },
          { x: 490, y: 284 },
        ],
      },
      {
        id: "edge-5",
        sourceId: "command-1",
        targetId: "event-4",
        sourceAnchor: { x: 430, y: 192, side: "bottom", ordinal: 1 },
        targetAnchor: { x: 650, y: 284, side: "top", ordinal: 0 },
        points: [
          { x: 430, y: 192 },
          { x: 430, y: 212 },
          { x: 650, y: 212 },
          { x: 650, y: 284 },
        ],
      },
    ]);
  });


});
