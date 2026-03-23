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

  it("reserves extra horizontal space for a group's footprint width without changing its bounds", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-1", laneId: "lane-0", groupId: "group-1", width: 120 },
        { id: "node-2", laneId: "lane-0", groupId: "group-2", width: 120 },
      ],
      edges: [],
      lanes: [{ id: "lane-0", order: 0 }],
      groups: [
        { id: "group-1", order: 0, footprintWidth: 300 },
        { id: "group-2", order: 1 },
      ],
      defaults: { nodeWidth: 120, nodeHeight: 48 },
      spacing: { groupGap: 80, minNodeGap: 40, minTargetShift: 20 },
    };

    const result = layout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.nodes).toEqual([
      { id: "node-1", x: 0, y: 0, width: 120, height: 48 },
      { id: "node-2", x: 380, y: 0, width: 120, height: 48 },
    ]);
    expect(result.result.groups).toEqual([
      { id: "group-1", x: 0, y: 0, width: 120, height: 48 },
      { id: "group-2", x: 380, y: 0, width: 120, height: 48 },
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

  it("lays out 11 nodes across lane-0, lane-1, lane-2", () => {
    const request: LayoutRequest = {
    nodes: [
      { id: "view-1", laneId: "lane-0", height: 90, width: 120 },
      { id: "command-1", laneId: "lane-1", height: 130, width: 120 },
      { id: "event-1", laneId: "lane-1", width: 120, height: 50 },
      { id: "event-2", laneId: "lane-1" },
      { id: "event-3", laneId: "lane-2" },
      { id: "event-4", laneId: "lane-2" },
      { id: "node-1", laneId: "lane-2" },
      { id: "node-2", laneId: "lane-1" },
      { id: "node-3", laneId: "lane-1" },
      { id: "node-4", laneId: "lane-0" },
      { id: "node-5", laneId: "lane-1" },
    ],
    edges: [
      { id: "edge-1", sourceId: "view-1", targetId: "command-1" },
      { id: "edge-3", sourceId: "event-1", targetId: "view-1" },
      { id: "edge-4", sourceId: "event-2", targetId: "view-1" },
      { id: "edge-2", sourceId: "command-1", targetId: "event-3" },
      { id: "edge-5", sourceId: "command-1", targetId: "event-4" },
      { id: "edge-6", sourceId: "command-1", targetId: "node-1" },
      { id: "edge-7", sourceId: "node-2", targetId: "view-1" },
      { id: "edge-8", sourceId: "view-1", targetId: "node-3" },
      { id: "edge-9", sourceId: "command-1", targetId: "node-4" },
      { id: "edge-10", sourceId: "event-4", targetId: "node-5" },
      { id: "edge-11", sourceId: "node-1", targetId: "node-5" },
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
      { id: "lane-0", top: -24, bottom: 114 },
      { id: "lane-1", top: 158, bottom: 336 },
      { id: "lane-2", top: 380, bottom: 476 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "view-1", x: 420, y: 0, width: 120, height: 90 },
      { id: "command-1", x: 510, y: 182, width: 120, height: 130 },
      { id: "event-1", x: 0, y: 182, width: 120, height: 50 },
      { id: "event-2", x: 160, y: 182, width: 120, height: 48 },
      { id: "event-3", x: 600, y: 404, width: 120, height: 48 },
      { id: "event-4", x: 760, y: 404, width: 120, height: 48 },
      { id: "node-1", x: 920, y: 404, width: 120, height: 48 },
      { id: "node-2", x: 320, y: 182, width: 120, height: 48 },
      { id: "node-3", x: 670, y: 182, width: 120, height: 48 },
      { id: "node-4", x: 640, y: 0, width: 120, height: 48 },
      { id: "node-5", x: 1050, y: 182, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "view-1",
        targetId: "command-1",
        sourceAnchor: { x: 490, y: 90, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 560, y: 182, side: "top", ordinal: 0 },
        points: [
          { x: 490, y: 90 },
          { x: 490, y: 120 },
          { x: 560, y: 120 },
          { x: 560, y: 182 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "event-1",
        targetId: "view-1",
        sourceAnchor: { x: 70, y: 182, side: "top", ordinal: 0 },
        targetAnchor: { x: 420, y: 40, side: "left", ordinal: 0 },
        points: [
          { x: 70, y: 182 },
          { x: 70, y: 162 },
          { x: 70, y: 40 },
          { x: 420, y: 40 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "event-2",
        targetId: "view-1",
        sourceAnchor: { x: 230, y: 182, side: "top", ordinal: 0 },
        targetAnchor: { x: 420, y: 50, side: "left", ordinal: 1 },
        points: [
          { x: 230, y: 182 },
          { x: 230, y: 162 },
          { x: 230, y: 50 },
          { x: 420, y: 50 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "command-1",
        targetId: "event-3",
        sourceAnchor: { x: 580, y: 312, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 650, y: 404, side: "top", ordinal: 0 },
        points: [
          { x: 580, y: 312 },
          { x: 580, y: 352 },
          { x: 650, y: 352 },
          { x: 650, y: 404 },
        ],
      },
      {
        id: "edge-5",
        sourceId: "command-1",
        targetId: "event-4",
        sourceAnchor: { x: 590, y: 312, side: "bottom", ordinal: 1 },
        targetAnchor: { x: 810, y: 404, side: "top", ordinal: 0 },
        points: [
          { x: 590, y: 312 },
          { x: 590, y: 342 },
          { x: 810, y: 342 },
          { x: 810, y: 404 },
        ],
      },
      {
        id: "edge-6",
        sourceId: "command-1",
        targetId: "node-1",
        sourceAnchor: { x: 600, y: 312, side: "bottom", ordinal: 2 },
        targetAnchor: { x: 970, y: 404, side: "top", ordinal: 0 },
        points: [
          { x: 600, y: 312 },
          { x: 600, y: 332 },
          { x: 970, y: 332 },
          { x: 970, y: 404 },
        ],
      },
      {
        id: "edge-7",
        sourceId: "node-2",
        targetId: "view-1",
        sourceAnchor: { x: 390, y: 182, side: "top", ordinal: 0 },
        targetAnchor: { x: 420, y: 60, side: "left", ordinal: 2 },
        points: [
          { x: 390, y: 182 },
          { x: 390, y: 162 },
          { x: 390, y: 60 },
          { x: 420, y: 60 },
        ],
      },
      {
        id: "edge-8",
        sourceId: "view-1",
        targetId: "node-3",
        sourceAnchor: { x: 500, y: 90, side: "bottom", ordinal: 1 },
        targetAnchor: { x: 720, y: 182, side: "top", ordinal: 0 },
        points: [
          { x: 500, y: 90 },
          { x: 500, y: 110 },
          { x: 720, y: 110 },
          { x: 720, y: 182 },
        ],
      },
      {
        id: "edge-9",
        sourceId: "command-1",
        targetId: "node-4",
        sourceAnchor: { x: 580, y: 182, side: "top", ordinal: 0 },
        targetAnchor: { x: 640, y: 19, side: "left", ordinal: 0 },
        points: [
          { x: 580, y: 182 },
          { x: 580, y: 162 },
          { x: 580, y: 19 },
          { x: 640, y: 19 },
        ],
      },
      {
        id: "edge-10",
        sourceId: "event-4",
        targetId: "node-5",
        sourceAnchor: { x: 830, y: 404, side: "top", ordinal: 0 },
        targetAnchor: { x: 1050, y: 201, side: "left", ordinal: 0 },
        points: [
          { x: 830, y: 404 },
          { x: 830, y: 384 },
          { x: 830, y: 201 },
          { x: 1050, y: 201 },
        ],
      },
      {
        id: "edge-11",
        sourceId: "node-1",
        targetId: "node-5",
        sourceAnchor: { x: 990, y: 404, side: "top", ordinal: 0 },
        targetAnchor: { x: 1050, y: 211, side: "left", ordinal: 1 },
        points: [
          { x: 990, y: 404 },
          { x: 990, y: 384 },
          { x: 990, y: 211 },
          { x: 1050, y: 211 },
        ],
      },
    ]);
  });

  it("lays out 5 nodes across lane-0, lane-1, lane-2", () => {
    const request: LayoutRequest = {
    nodes: [
      { id: "node-1", laneId: "lane-0", groupId: "group-4" },
      { id: "node-2", laneId: "lane-1", groupId: "group-4" },
      { id: "node-3", laneId: "lane-2", groupId: "group-4" },
      { id: "node-4", laneId: "lane-1", groupId: "group-3" },
      { id: "node-5", laneId: "lane-0", groupId: "group-3" },
    ],
    edges: [
      { id: "edge-1", sourceId: "node-1", targetId: "node-2" },
      { id: "edge-2", sourceId: "node-2", targetId: "node-3" },
      { id: "edge-3", sourceId: "node-3", targetId: "node-4" },
      { id: "edge-4", sourceId: "node-4", targetId: "node-5" },
    ],
    lanes: [
      { id: "lane-0", order: 0 },
      { id: "lane-1", order: 1 },
      { id: "lane-2", order: 2 },
    ],
    groups: [
      { id: "group-4", order: 0 },
      { id: "group-3", order: 1 },
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
      { id: "lane-0", top: -24, bottom: 72 },
      { id: "lane-1", top: 116, bottom: 212 },
      { id: "lane-2", top: 256, bottom: 352 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-1", x: 0, y: 0, width: 120, height: 48 },
      { id: "node-2", x: 100, y: 140, width: 120, height: 48 },
      { id: "node-3", x: 190, y: 280, width: 120, height: 48 },
      { id: "node-4", x: 390, y: 140, width: 120, height: 48 },
      { id: "node-5", x: 490, y: 0, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-2",
        sourceAnchor: { x: 70, y: 48, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 150, y: 140, side: "top", ordinal: 0 },
        points: [
          { x: 70, y: 48 },
          { x: 70, y: 68 },
          { x: 150, y: 68 },
          { x: 150, y: 140 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "node-2",
        targetId: "node-3",
        sourceAnchor: { x: 170, y: 188, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 240, y: 280, side: "top", ordinal: 0 },
        points: [
          { x: 170, y: 188 },
          { x: 170, y: 208 },
          { x: 240, y: 208 },
          { x: 240, y: 280 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "node-3",
        targetId: "node-4",
        sourceAnchor: { x: 260, y: 280, side: "top", ordinal: 0 },
        targetAnchor: { x: 390, y: 159, side: "left", ordinal: 0 },
        points: [
          { x: 260, y: 280 },
          { x: 260, y: 260 },
          { x: 260, y: 159 },
          { x: 390, y: 159 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "node-4",
        targetId: "node-5",
        sourceAnchor: { x: 460, y: 140, side: "top", ordinal: 0 },
        targetAnchor: { x: 490, y: 19, side: "left", ordinal: 0 },
        points: [
          { x: 460, y: 140 },
          { x: 460, y: 120 },
          { x: 460, y: 19 },
          { x: 490, y: 19 },
        ],
      },
    ]);
  });

  it("lays out 6 nodes across lane-0, lane-1, lane-2", () => {
    const request: LayoutRequest = {
    nodes: [
      { id: "node-1", laneId: "lane-0", groupId: "group-6" },
      { id: "node-2", laneId: "lane-1", groupId: "group-6", width: 140, height: 70 },
      { id: "node-3", laneId: "lane-2", groupId: "group-6" },
      { id: "node-4", laneId: "lane-1", groupId: "group-1" },
      { id: "node-5", laneId: "lane-0", groupId: "group-1" },
      { id: "node-6", laneId: "lane-2", groupId: "group-6" },
    ],
    edges: [
      { id: "edge-1", sourceId: "node-1", targetId: "node-2" },
      { id: "edge-2", sourceId: "node-2", targetId: "node-3" },
      { id: "edge-4", sourceId: "node-4", targetId: "node-5" },
      { id: "edge-5", sourceId: "node-2", targetId: "node-6" },
      { id: "edge-3", sourceId: "node-6", targetId: "node-4" },
    ],
    lanes: [
      { id: "lane-0", order: 0 },
      { id: "lane-1", order: 1 },
      { id: "lane-2", order: 2 },
    ],
    groups: [
      { id: "group-6", order: 0 },
      { id: "group-1", order: 1 },
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
      { id: "lane-0", top: -24, bottom: 72 },
      { id: "lane-1", top: 116, bottom: 234 },
      { id: "lane-2", top: 278, bottom: 374 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-1", x: 0, y: 0, width: 120, height: 48 },
      { id: "node-2", x: 90, y: 140, width: 140, height: 70 },
      { id: "node-3", x: 200, y: 302, width: 120, height: 48 },
      { id: "node-4", x: 560, y: 140, width: 120, height: 48 },
      { id: "node-5", x: 660, y: 0, width: 120, height: 48 },
      { id: "node-6", x: 360, y: 302, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-2",
        sourceAnchor: { x: 70, y: 48, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 150, y: 140, side: "top", ordinal: 0 },
        points: [
          { x: 70, y: 48 },
          { x: 70, y: 68 },
          { x: 150, y: 68 },
          { x: 150, y: 140 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "node-2",
        targetId: "node-3",
        sourceAnchor: { x: 170, y: 210, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 250, y: 302, side: "top", ordinal: 0 },
        points: [
          { x: 170, y: 210 },
          { x: 170, y: 240 },
          { x: 250, y: 240 },
          { x: 250, y: 302 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "node-4",
        targetId: "node-5",
        sourceAnchor: { x: 630, y: 140, side: "top", ordinal: 0 },
        targetAnchor: { x: 660, y: 19, side: "left", ordinal: 0 },
        points: [
          { x: 630, y: 140 },
          { x: 630, y: 120 },
          { x: 630, y: 19 },
          { x: 660, y: 19 },
        ],
      },
      {
        id: "edge-5",
        sourceId: "node-2",
        targetId: "node-6",
        sourceAnchor: { x: 180, y: 210, side: "bottom", ordinal: 1 },
        targetAnchor: { x: 410, y: 302, side: "top", ordinal: 0 },
        points: [
          { x: 180, y: 210 },
          { x: 180, y: 230 },
          { x: 410, y: 230 },
          { x: 410, y: 302 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "node-6",
        targetId: "node-4",
        sourceAnchor: { x: 430, y: 302, side: "top", ordinal: 0 },
        targetAnchor: { x: 560, y: 159, side: "left", ordinal: 0 },
        points: [
          { x: 430, y: 302 },
          { x: 430, y: 282 },
          { x: 430, y: 159 },
          { x: 560, y: 159 },
        ],
      },
    ]);
  });

  it("routes a farther upward sibling edge around the nearer target node", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-6", laneId: "lane-1" },
        { id: "node-4", laneId: "lane-0", height: 50 },
        { id: "node-7", laneId: "lane-0" },
      ],
      edges: [
        { id: "edge-1", sourceId: "node-6", targetId: "node-4" },
        { id: "edge-2", sourceId: "node-6", targetId: "node-7" },
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
      { id: "lane-1", top: 118, bottom: 214 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-6", x: 0, y: 142, width: 120, height: 48 },
      { id: "node-4", x: 100, y: 0, width: 120, height: 50 },
      { id: "node-7", x: 260, y: 0, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "node-6",
        targetId: "node-4",
        sourceAnchor: { x: 70, y: 142, side: "top", ordinal: 0 },
        targetAnchor: { x: 100, y: 20, side: "left", ordinal: 0 },
        points: [
          { x: 70, y: 142 },
          { x: 70, y: 122 },
          { x: 70, y: 20 },
          { x: 100, y: 20 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "node-6",
        targetId: "node-7",
        sourceAnchor: { x: 80, y: 142, side: "top", ordinal: 1 },
        targetAnchor: { x: 260, y: 19, side: "left", ordinal: 0 },
        points: [
          { x: 80, y: 142 },
          { x: 80, y: 120 },
          { x: 80, y: 60 },
          { x: 240, y: 60 },
          { x: 240, y: 19 },
          { x: 260, y: 19 },
        ],
      },
    ]);
  });

it("reroutes multiple edges", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-6", laneId: "lane-1" },
        { id: "node-4", laneId: "lane-0", height: 50 },
        { id: "node-7", laneId: "lane-0" },
        { id: "node-1", laneId: "lane-0" },
      ],
      edges: [
        { id: "edge-1", sourceId: "node-6", targetId: "node-4" },
        { id: "edge-2", sourceId: "node-6", targetId: "node-7" },
        { id: "edge-3", sourceId: "node-6", targetId: "node-1" },
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
      { id: "lane-1", top: 118, bottom: 214 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-6", x: 0, y: 142, width: 120, height: 48 },
      { id: "node-4", x: 100, y: 0, width: 120, height: 50 },
      { id: "node-7", x: 260, y: 0, width: 120, height: 48 },
      { id: "node-1", x: 420, y: 0, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "node-6",
        targetId: "node-4",
        sourceAnchor: { x: 70, y: 142, side: "top", ordinal: 0 },
        targetAnchor: { x: 100, y: 20, side: "left", ordinal: 0 },
        points: [
          { x: 70, y: 142 },
          { x: 70, y: 122 },
          { x: 70, y: 20 },
          { x: 100, y: 20 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "node-6",
        targetId: "node-7",
        sourceAnchor: { x: 80, y: 142, side: "top", ordinal: 1 },
        targetAnchor: { x: 260, y: 19, side: "left", ordinal: 0 },
        points: [
          { x: 80, y: 142 },
          { x: 80, y: 120 },
          { x: 80, y: 60 },
          { x: 240, y: 60 },
          { x: 240, y: 19 },
          { x: 260, y: 19 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "node-6",
        targetId: "node-1",
        sourceAnchor: { x: 90, y: 142, side: "top", ordinal: 2 },
        targetAnchor: { x: 420, y: 19, side: "left", ordinal: 0 },
        points: [
          { x: 90, y: 142 },
          { x: 90, y: 120 },
          { x: 90, y: 70 },
          { x: 400, y: 70 },
          { x: 400, y: 19 },
          { x: 420, y: 19 },
        ],
      },
    ]);
  });

  it("rerouting avoids collisions of previous target nodes", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-6", laneId: "lane-1" },
        { id: "node-4", laneId: "lane-0", height: 50 },
        { id: "node-7", laneId: "lane-0", width: 120, height: 70 },
        { id: "node-1", laneId: "lane-0" },
      ],
      edges: [
        { id: "edge-1", sourceId: "node-6", targetId: "node-4" },
        { id: "edge-2", sourceId: "node-6", targetId: "node-7" },
        { id: "edge-3", sourceId: "node-6", targetId: "node-1" },
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
      { id: "lane-0", top: -24, bottom: 94 },
      { id: "lane-1", top: 138, bottom: 234 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-6", x: 0, y: 162, width: 120, height: 48 },
      { id: "node-4", x: 100, y: 0, width: 120, height: 50 },
      { id: "node-7", x: 260, y: 0, width: 120, height: 70 },
      { id: "node-1", x: 420, y: 0, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "node-6",
        targetId: "node-4",
        sourceAnchor: { x: 70, y: 162, side: "top", ordinal: 0 },
        targetAnchor: { x: 100, y: 20, side: "left", ordinal: 0 },
        points: [
          { x: 70, y: 162 },
          { x: 70, y: 142 },
          { x: 70, y: 20 },
          { x: 100, y: 20 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "node-6",
        targetId: "node-7",
        sourceAnchor: { x: 80, y: 162, side: "top", ordinal: 1 },
        targetAnchor: { x: 260, y: 30, side: "left", ordinal: 0 },
        points: [
          { x: 80, y: 162 },
          { x: 80, y: 140 },
          { x: 80, y: 60 },
          { x: 240, y: 60 },
          { x: 240, y: 30 },
          { x: 260, y: 30 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "node-6",
        targetId: "node-1",
        sourceAnchor: { x: 90, y: 162, side: "top", ordinal: 2 },
        targetAnchor: { x: 420, y: 19, side: "left", ordinal: 0 },
        points: [
          { x: 90, y: 162 },
          { x: 90, y: 140 },
          { x: 90, y: 80 },
          { x: 400, y: 80 },
          { x: 400, y: 19 },
          { x: 420, y: 19 },
        ],
      },
    ]);
  });

  it("keeps a gap between rerouted edges", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-6", laneId: "lane-1" },
        { id: "node-4", laneId: "lane-0", height: 50 },
        { id: "node-7", laneId: "lane-0", width: 120, height: 70 },
        { id: "node-1", laneId: "lane-0", height: 48 },
      ],
      edges: [
        { id: "edge-2", sourceId: "node-6", targetId: "node-1" },
        { id: "edge-3", sourceId: "node-6", targetId: "node-4" },
        { id: "edge-1", sourceId: "node-6", targetId: "node-7" },
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
      { id: "lane-0", top: -24, bottom: 94 },
      { id: "lane-1", top: 138, bottom: 234 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-6", x: 0, y: 162, width: 120, height: 48 },
      { id: "node-4", x: 260, y: 0, width: 120, height: 50 },
      { id: "node-7", x: 420, y: 0, width: 120, height: 70 },
      { id: "node-1", x: 100, y: 0, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-2",
        sourceId: "node-6",
        targetId: "node-1",
        sourceAnchor: { x: 70, y: 162, side: "top", ordinal: 0 },
        targetAnchor: { x: 100, y: 19, side: "left", ordinal: 0 },
        points: [
          { x: 70, y: 162 },
          { x: 70, y: 142 },
          { x: 70, y: 19 },
          { x: 100, y: 19 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "node-6",
        targetId: "node-4",
        sourceAnchor: { x: 80, y: 162, side: "top", ordinal: 1 },
        targetAnchor: { x: 260, y: 20, side: "left", ordinal: 0 },
        points: [
          { x: 80, y: 162 },
          { x: 80, y: 140 },
          { x: 80, y: 58 },
          { x: 240, y: 58 },
          { x: 240, y: 20 },
          { x: 260, y: 20 },
        ],
      },
      {
        id: "edge-1",
        sourceId: "node-6",
        targetId: "node-7",
        sourceAnchor: { x: 90, y: 162, side: "top", ordinal: 2 },
        targetAnchor: { x: 420, y: 30, side: "left", ordinal: 0 },
        points: [
          { x: 90, y: 162 },
          { x: 90, y: 140 },
          { x: 90, y: 68 },
          { x: 400, y: 68 },
          { x: 400, y: 30 },
          { x: 420, y: 30 },
        ],
      },
    ]);
  });

it("keeps a gap between rerouted and non-rerouted edges", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-6", laneId: "lane-1" },
        { id: "node-4", laneId: "lane-0", height: 50 },
        { id: "node-1", laneId: "lane-0", height: 48, width: 120 },
        { id: "node-2", laneId: "lane-0", width: 120, height: 140 },
      ],
      edges: [
        { id: "edge-2", sourceId: "node-6", targetId: "node-1" },
        { id: "edge-3", sourceId: "node-6", targetId: "node-4" },
        { id: "edge-4", sourceId: "node-6", targetId: "node-2" },
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
      { id: "lane-0", top: -24, bottom: 164 },
      { id: "lane-1", top: 208, bottom: 304 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-6", x: 0, y: 232, width: 120, height: 48 },
      { id: "node-4", x: 260, y: 0, width: 120, height: 50 },
      { id: "node-1", x: 100, y: 0, width: 120, height: 48 },
      { id: "node-2", x: 420, y: 0, width: 120, height: 140 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-2",
        sourceId: "node-6",
        targetId: "node-1",
        sourceAnchor: { x: 70, y: 232, side: "top", ordinal: 0 },
        targetAnchor: { x: 100, y: 19, side: "left", ordinal: 0 },
        points: [
          { x: 70, y: 232 },
          { x: 70, y: 212 },
          { x: 70, y: 19 },
          { x: 100, y: 19 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "node-6",
        targetId: "node-4",
        sourceAnchor: { x: 80, y: 232, side: "top", ordinal: 1 },
        targetAnchor: { x: 260, y: 20, side: "left", ordinal: 0 },
        points: [
          { x: 80, y: 232 },
          { x: 80, y: 210 },
          { x: 80, y: 58 },
          { x: 240, y: 58 },
          { x: 240, y: 20 },
          { x: 260, y: 20 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "node-6",
        targetId: "node-2",
        sourceAnchor: { x: 90, y: 232, side: "top", ordinal: 2 },
        targetAnchor: { x: 420, y: 68, side: "left", ordinal: 0 },
        points: [
          { x: 90, y: 232 },
          { x: 90, y: 212 },
          { x: 90, y: 68 },
          { x: 420, y: 68 },
        ],
      },
    ]);
  });

});

describe("down arrow collision avoidance", () => {
  it("avoid collisions between down arrows", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-2", laneId: "lane-1", height: 48 },
        { id: "node-3", laneId: "lane-1", height: 80, width: 120 },
        { id: "node-4", laneId: "lane-2" },
      ],
      edges: [
        { id: "edge-3", sourceId: "node-2", targetId: "node-4" },
        { id: "edge-4", sourceId: "node-3", targetId: "node-4" },
      ],
      lanes: [
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
      { id: "lane-1", top: -24, bottom: 104 },
      { id: "lane-2", top: 148, bottom: 244 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-2", x: 0, y: 0, width: 120, height: 48 },
      { id: "node-3", x: 160, y: 0, width: 120, height: 80 },
      { id: "node-4", x: 260, y: 172, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-3",
        sourceId: "node-2",
        targetId: "node-4",
        sourceAnchor: { x: 70, y: 48, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 310, y: 172, side: "top", ordinal: 0 },
        points: [
          { x: 70, y: 48 },
          { x: 70, y: 110 },
          { x: 310, y: 110 },
          { x: 310, y: 172 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "node-3",
        targetId: "node-4",
        sourceAnchor: { x: 230, y: 80, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 320, y: 172, side: "top", ordinal: 1 },
        points: [
          { x: 230, y: 80 },
          { x: 230, y: 100 },
          { x: 320, y: 100 },
          { x: 320, y: 172 },
        ],
      },
    ]);
  });

  it("lays out downward fan-in edges", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-1", laneId: "lane-0", width: 120 },
        { id: "node-2", laneId: "lane-1" },
        { id: "node-3", laneId: "lane-0" },
      ],
      edges: [
        { id: "edge-1", sourceId: "node-1", targetId: "node-2" },
        { id: "edge-2", sourceId: "node-3", targetId: "node-2" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
      ],
      defaults: { nodeWidth: 120, nodeHeight: 48 },
      spacing: { groupGap: 80, minNodeGap: 40, minTargetShift: 20 },
    };

    const result = layout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: -24, bottom: 72 },
      { id: "lane-1", top: 116, bottom: 212 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-1", x: 0, y: 0, width: 120, height: 48 },
      { id: "node-2", x: 260, y: 140, width: 120, height: 48 },
      { id: "node-3", x: 160, y: 0, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-2",
        sourceAnchor: { x: 70, y: 48, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 310, y: 140, side: "top", ordinal: 0 },
        points: [
          { x: 70, y: 48 },
          { x: 70, y: 80 },
          { x: 310, y: 80 },
          { x: 310, y: 140 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "node-3",
        targetId: "node-2",
        sourceAnchor: { x: 230, y: 48, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 320, y: 140, side: "top", ordinal: 1 },
        points: [
          { x: 230, y: 48 },
          { x: 230, y: 70 },
          { x: 320, y: 70 },
          { x: 320, y: 140 },
        ],
      },
    ]);
  });

});
