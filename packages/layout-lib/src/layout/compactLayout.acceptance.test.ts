import {describe, expect, it} from 'vitest';
import {compactLayout} from './compactLayout';
import type {LayoutRequest} from './types';

describe('compactLayout acceptance', () => {
  it('preserves edge roles on layout result edges', () => {
    const request: LayoutRequest = {
      nodes: [
        {id: 'command', laneId: 'lane-0', width: 120, height: 70},
        {id: 'event', laneId: 'lane-1', width: 120, height: 70},
      ],
      edges: [
        {id: 'edge-command-event', sourceId: 'command', targetId: 'event', role: 'back-reference'},
      ],
      lanes: [
        {id: 'lane-0', order: 0},
        {id: 'lane-1', order: 1},
      ],
      defaults: {nodeWidth: 120, nodeHeight: 48},
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.edges[0]).toMatchObject({
      id: 'edge-command-event',
      role: 'back-reference',
    });
  });

  it("lays out 8 nodes across lane-0, lane-1, lane-2 (original)", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "Enter Booking", laneId: "lane-0", width: 120, height: 70 },
        { id: "Add Booking", laneId: "lane-1", width: 120, height: 70 },
        { id: "Tentative Booking Added", laneId: "lane-2", width: 120, height: 70 },
        { id: "Tentative Bookings", laneId: "lane-1", width: 120, height: 70 },
        { id: "Confirm Screen", laneId: "lane-0", width: 120, height: 70 },
        { id: "Confirm Booking", laneId: "lane-1", width: 120, height: 70 },
        { id: "Is Booking Tentative", laneId: "lane-1", width: 120, height: 70 },
        { id: "Booking Confirmed", laneId: "lane-2", width: 120, height: 70 },
      ],
      edges: [
        { id: "edge-1", sourceId: "Enter Booking", targetId: "Add Booking" },
        { id: "edge-2", sourceId: "Add Booking", targetId: "Tentative Booking Added" },
        { id: "edge-3", sourceId: "Tentative Booking Added", targetId: "Tentative Bookings" },
        { id: "edge-4", sourceId: "Tentative Bookings", targetId: "Confirm Screen" },
        { id: "edge-5", sourceId: "Confirm Screen", targetId: "Confirm Booking" },
        { id: "edge-6", sourceId: "Tentative Booking Added", targetId: "Is Booking Tentative" },
        { id: "edge-8", sourceId: "Confirm Booking", targetId: "Booking Confirmed" },
        { id: "edge-7", sourceId: "Is Booking Tentative", targetId: "Confirm Booking" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 120, nodeHeight: 48 },
      spacing: { groupGap: 80, minNodeGap: 40, minTargetShift: 20 },
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: -24, bottom: 94 },
      { id: "lane-1", top: 138, bottom: 256 },
      { id: "lane-2", top: 300, bottom: 418 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "Enter Booking", x: 0, y: 0, width: 120, height: 70 },
      { id: "Add Booking", x: 20, y: 162, width: 120, height: 70 },
      { id: "Tentative Booking Added", x: 40, y: 324, width: 120, height: 70 },
      { id: "Tentative Bookings", x: 170, y: 162, width: 120, height: 70 },
      { id: "Confirm Screen", x: 190, y: 0, width: 120, height: 70 },
      { id: "Confirm Booking", x: 500, y: 162, width: 120, height: 70 },
      { id: "Is Booking Tentative", x: 320, y: 162, width: 120, height: 70 },
      { id: "Booking Confirmed", x: 520, y: 324, width: 120, height: 70 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "Enter Booking",
        targetId: "Add Booking",
        sourceAnchor: { x: 70, y: 70, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 70, y: 162, side: "top", ordinal: 0 },
        points: [
          { x: 70, y: 70 },
          { x: 70, y: 90 },
          { x: 70, y: 90 },
          { x: 70, y: 162 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "Add Booking",
        targetId: "Tentative Booking Added",
        sourceAnchor: { x: 90, y: 232, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 90, y: 324, side: "top", ordinal: 0 },
        points: [
          { x: 90, y: 232 },
          { x: 90, y: 252 },
          { x: 90, y: 252 },
          { x: 90, y: 324 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "Tentative Booking Added",
        targetId: "Tentative Bookings",
        sourceAnchor: { x: 110, y: 324, side: "top", ordinal: 0 },
        targetAnchor: { x: 220, y: 232, side: "bottom", ordinal: 0 },
        points: [
          { x: 110, y: 324 },
          { x: 110, y: 270 },
          { x: 220, y: 270 },
          { x: 220, y: 232 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "Tentative Bookings",
        targetId: "Confirm Screen",
        sourceAnchor: { x: 240, y: 162, side: "top", ordinal: 0 },
        targetAnchor: { x: 240, y: 70, side: "bottom", ordinal: 0 },
        points: [
          { x: 240, y: 162 },
          { x: 240, y: 90 },
          { x: 240, y: 90 },
          { x: 240, y: 70 },
        ],
      },
      {
        id: "edge-5",
        sourceId: "Confirm Screen",
        targetId: "Confirm Booking",
        sourceAnchor: { x: 260, y: 70, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 550, y: 162, side: "top", ordinal: 0 },
        points: [
          { x: 260, y: 70 },
          { x: 260, y: 90 },
          { x: 550, y: 90 },
          { x: 550, y: 162 },
        ],
      },
      {
        id: "edge-6",
        sourceId: "Tentative Booking Added",
        targetId: "Is Booking Tentative",
        sourceAnchor: { x: 120, y: 324, side: "top", ordinal: 0 },
        targetAnchor: { x: 370, y: 232, side: "bottom", ordinal: 0 },
        points: [
          { x: 120, y: 324 },
          { x: 120, y: 280 },
          { x: 370, y: 280 },
          { x: 370, y: 232 },
        ],
      },
      {
        id: "edge-8",
        sourceId: "Confirm Booking",
        targetId: "Booking Confirmed",
        sourceAnchor: { x: 570, y: 232, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 570, y: 324, side: "top", ordinal: 0 },
        points: [
          { x: 570, y: 232 },
          { x: 570, y: 252 },
          { x: 570, y: 252 },
          { x: 570, y: 324 },
        ],
      },
      {
        id: "edge-7",
        sourceId: "Is Booking Tentative",
        targetId: "Confirm Booking",
        sourceAnchor: { x: 440, y: 200, side: "right", ordinal: 0 },
        targetAnchor: { x: 500, y: 200, side: "left", ordinal: 0 },
        points: [
          { x: 440, y: 200 },
          { x: 460, y: 200 },
          { x: 460, y: 200 },
          { x: 500, y: 200 },
        ],
      },
    ]);
  });

  it('Source anchor points for down-edges are to the right of the node center', () => {
    const request: LayoutRequest = {
      nodes: [
        {id: 'node-1', laneId: 'lane-0', width: 220, height: 50},
        {id: 'node-2', laneId: 'lane-1'},
        {id: 'node-3', laneId: 'lane-0'},
      ],
      edges: [
        {id: 'edge-1', sourceId: 'node-1', targetId: 'node-2'},
        {id: 'edge-2', sourceId: 'node-2', targetId: 'node-3'},
      ],
      lanes: [
        {id: 'lane-0', order: 0},
        {id: 'lane-1', order: 1},
        {id: 'lane-2', order: 2},
      ],
      defaults: {nodeWidth: 120, nodeHeight: 48},
      spacing: {groupGap: 80, minNodeGap: 40, minTargetShift: 20},
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      {id: 'lane-0', top: -24, bottom: 74},
      {id: 'lane-1', top: 118, bottom: 214},
      {id: 'lane-2', top: 258, bottom: 354},
    ]);
    expect(result.result.nodes).toEqual([
      {id: 'node-1', x: 0, y: 0, width: 220, height: 50},
      {id: 'node-2', x: 70, y: 142, width: 120, height: 48},
      {id: 'node-3', x: 250, y: 0, width: 120, height: 48},
    ]);
    expect(result.result.edges).toEqual([
      {
        id: 'edge-1',
        sourceId: 'node-1',
        targetId: 'node-2',
        sourceAnchor: {x: 120, y: 50, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 120, y: 142, side: 'top', ordinal: 0},
        points: [
          {x: 120, y: 50},
          {x: 120, y: 70},
          {x: 120, y: 70},
          {x: 120, y: 142},
        ],
      },
      {
        id: 'edge-2',
        sourceId: 'node-2',
        targetId: 'node-3',
        sourceAnchor: {x: 140, y: 142, side: 'top', ordinal: 0},
        targetAnchor: {x: 300, y: 48, side: 'bottom', ordinal: 0},
        points: [
          {x: 140, y: 142},
          {x: 140, y: 122},
          {x: 300, y: 122},
          {x: 300, y: 48},
        ],
      },
    ]);
  });

  it("lays out 8 nodes across lane-0, lane-1, lane-2", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "Enter Booking", laneId: "lane-0" },
        { id: "Add Booking", laneId: "lane-1" },
        { id: "Tentative Booking Added", laneId: "lane-2" },
        { id: "Tentative Bookings", laneId: "lane-1" },
        { id: "Confirm Screen", laneId: "lane-0" },
        { id: "Confirm Booking", laneId: "lane-1" },
        { id: "Is Booking Tentative", laneId: "lane-1" },
        { id: "Booking Confirmed", laneId: "lane-2" },
      ],
      edges: [
        { id: "edge-1", sourceId: "Enter Booking", targetId: "Add Booking" },
        { id: "edge-2", sourceId: "Add Booking", targetId: "Tentative Booking Added" },
        { id: "edge-3", sourceId: "Tentative Booking Added", targetId: "Tentative Bookings" },
        { id: "edge-4", sourceId: "Tentative Bookings", targetId: "Confirm Screen" },
        { id: "edge-5", sourceId: "Confirm Screen", targetId: "Confirm Booking" },
        { id: "edge-6", sourceId: "Tentative Booking Added", targetId: "Is Booking Tentative" },
        { id: "edge-7", sourceId: "Is Booking Tentative", targetId: "Confirm Booking" },
        { id: "edge-8", sourceId: "Confirm Booking", targetId: "Booking Confirmed" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 120, nodeHeight: 48 },
      spacing: { groupGap: 80, minNodeGap: 40, minTargetShift: 20 },
    };

    const result = compactLayout(request);

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
      { id: "Enter Booking", x: 0, y: 0, width: 120, height: 48 },
      { id: "Add Booking", x: 20, y: 140, width: 120, height: 48 },
      { id: "Tentative Booking Added", x: 40, y: 280, width: 120, height: 48 },
      { id: "Tentative Bookings", x: 170, y: 140, width: 120, height: 48 },
      { id: "Confirm Screen", x: 190, y: 0, width: 120, height: 48 },
      { id: "Confirm Booking", x: 500, y: 140, width: 120, height: 48 },
      { id: "Is Booking Tentative", x: 320, y: 140, width: 120, height: 48 },
      { id: "Booking Confirmed", x: 520, y: 280, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "Enter Booking",
        targetId: "Add Booking",
        sourceAnchor: { x: 70, y: 48, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 70, y: 140, side: "top", ordinal: 0 },
        points: [
          { x: 70, y: 48 },
          { x: 70, y: 68 },
          { x: 70, y: 68 },
          { x: 70, y: 140 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "Add Booking",
        targetId: "Tentative Booking Added",
        sourceAnchor: { x: 90, y: 188, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 90, y: 280, side: "top", ordinal: 0 },
        points: [
          { x: 90, y: 188 },
          { x: 90, y: 208 },
          { x: 90, y: 208 },
          { x: 90, y: 280 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "Tentative Booking Added",
        targetId: "Tentative Bookings",
        sourceAnchor: { x: 110, y: 280, side: "top", ordinal: 0 },
        targetAnchor: { x: 220, y: 188, side: "bottom", ordinal: 0 },
        points: [
          { x: 110, y: 280 },
          { x: 110, y: 240 },
          { x: 220, y: 240 },
          { x: 220, y: 188 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "Tentative Bookings",
        targetId: "Confirm Screen",
        sourceAnchor: { x: 240, y: 140, side: "top", ordinal: 0 },
        targetAnchor: { x: 240, y: 48, side: "bottom", ordinal: 0 },
        points: [
          { x: 240, y: 140 },
          { x: 240, y: 90 },
          { x: 240, y: 90 },
          { x: 240, y: 48 },
        ],
      },
      {
        id: "edge-5",
        sourceId: "Confirm Screen",
        targetId: "Confirm Booking",
        sourceAnchor: { x: 260, y: 48, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 550, y: 140, side: "top", ordinal: 0 },
        points: [
          { x: 260, y: 48 },
          { x: 260, y: 68 },
          { x: 550, y: 68 },
          { x: 550, y: 140 },
        ],
      },
      {
        id: "edge-6",
        sourceId: "Tentative Booking Added",
        targetId: "Is Booking Tentative",
        sourceAnchor: { x: 120, y: 280, side: "top", ordinal: 0 },
        targetAnchor: { x: 360, y: 188, side: "bottom", ordinal: 0 },
        points: [
          { x: 120, y: 280 },
          { x: 120, y: 250 },
          { x: 360, y: 250 },
          { x: 360, y: 188 },
        ],
      },
      {
        id: "edge-7",
        sourceId: "Is Booking Tentative",
        targetId: "Confirm Booking",
        sourceAnchor: { x: 440, y: 160, side: "right", ordinal: 0 },
        targetAnchor: { x: 500, y: 160, side: "left", ordinal: 0 },
        points: [
          { x: 440, y: 160 },
          { x: 460, y: 160 },
          { x: 460, y: 160 },
          { x: 500, y: 160 },
        ],
      },
      {
        id: "edge-8",
        sourceId: "Confirm Booking",
        targetId: "Booking Confirmed",
        sourceAnchor: { x: 570, y: 188, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 570, y: 280, side: "top", ordinal: 0 },
        points: [
          { x: 570, y: 188 },
          { x: 570, y: 208 },
          { x: 570, y: 208 },
          { x: 570, y: 280 },
        ],
      },
    ]);
  });

  it('lays out security settings graph', () => {
    const request: LayoutRequest = {
      nodes: [
        {id: 'node-1', laneId: 'lane-0', width: 180, height: 86},
        {id: 'node-2', laneId: 'lane-1', width: 180, height: 86},
        {id: 'node-3', laneId: 'lane-2', width: 180, height: 86},
        {id: 'node-4', laneId: 'lane-0', width: 180, height: 86},
        {id: 'node-5', laneId: 'lane-1', width: 180, height: 86},
        {id: 'node-6', laneId: 'lane-2', width: 180, height: 86},
        {id: 'node-7', laneId: 'lane-1', width: 180, height: 86},
      ],
      edges: [
        {id: 'edge-node-1-node-2', sourceId: 'node-1', targetId: 'node-2'},
        {id: 'edge-node-2-node-3', sourceId: 'node-2', targetId: 'node-3'},
        {id: 'edge-node-4-node-5', sourceId: 'node-4', targetId: 'node-5'},
        {id: 'edge-node-5-node-6', sourceId: 'node-5', targetId: 'node-6'},
        {id: 'edge-node-6-node-7', sourceId: 'node-6', targetId: 'node-7'},
      ],
      lanes: [
        {id: 'lane-0', order: 0},
        {id: 'lane-1', order: 1},
        {id: 'lane-2', order: 2},
      ],
      defaults: {nodeWidth: 120, nodeHeight: 48},
      spacing: {groupGap: 80, minNodeGap: 40, minTargetShift: 20},
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      {id: 'lane-0', top: -24, bottom: 110},
      {id: 'lane-1', top: 154, bottom: 288},
      {id: 'lane-2', top: 332, bottom: 466},
    ]);
    expect(result.result.nodes).toEqual([
      {id: 'node-1', x: 0, y: 0, width: 180, height: 86},
      {id: 'node-2', x: 20, y: 178, width: 180, height: 86},
      {id: 'node-3', x: 40, y: 356, width: 180, height: 86},
      {id: 'node-4', x: 210, y: 0, width: 180, height: 86},
      {id: 'node-5', x: 230, y: 178, width: 180, height: 86},
      {id: 'node-6', x: 250, y: 356, width: 180, height: 86},
      {id: 'node-7', x: 440, y: 178, width: 180, height: 86},
    ]);
    expect(result.result.edges).toEqual([
      {
        id: 'edge-node-1-node-2',
        sourceId: 'node-1',
        targetId: 'node-2',
        sourceAnchor: {x: 100, y: 86, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 100, y: 178, side: 'top', ordinal: 0},
        points: [
          {x: 100, y: 86},
          {x: 100, y: 106},
          {x: 100, y: 106},
          {x: 100, y: 178},
        ],
      },
      {
        id: 'edge-node-2-node-3',
        sourceId: 'node-2',
        targetId: 'node-3',
        sourceAnchor: {x: 120, y: 264, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 120, y: 356, side: 'top', ordinal: 0},
        points: [
          {x: 120, y: 264},
          {x: 120, y: 284},
          {x: 120, y: 284},
          {x: 120, y: 356},
        ],
      },
      {
        id: 'edge-node-4-node-5',
        sourceId: 'node-4',
        targetId: 'node-5',
        sourceAnchor: {x: 310, y: 86, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 310, y: 178, side: 'top', ordinal: 0},
        points: [
          {x: 310, y: 86},
          {x: 310, y: 106},
          {x: 310, y: 106},
          {x: 310, y: 178},
        ],
      },
      {
        id: 'edge-node-5-node-6',
        sourceId: 'node-5',
        targetId: 'node-6',
        sourceAnchor: {x: 330, y: 264, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 330, y: 356, side: 'top', ordinal: 0},
        points: [
          {x: 330, y: 264},
          {x: 330, y: 284},
          {x: 330, y: 284},
          {x: 330, y: 356},
        ],
      },
      {
        id: 'edge-node-6-node-7',
        sourceId: 'node-6',
        targetId: 'node-7',
        sourceAnchor: {x: 350, y: 356, side: 'top', ordinal: 0},
        targetAnchor: {x: 520, y: 264, side: 'bottom', ordinal: 0},
        points: [
          {x: 350, y: 356},
          {x: 350, y: 306},
          {x: 520, y: 306},
          {x: 520, y: 264},
        ],
      },
    ]);
  });

  it("allow edges to cross", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-1", laneId: "lane-1", height: 50 },
        { id: "node-2", laneId: "lane-2", height: 50 },
        { id: "node-3", laneId: "lane-1", height: 50 },
        { id: "node-4", laneId: "lane-2", height: 50 },
        { id: "node-5", laneId: "lane-1", height: 50 },
      ],
      edges: [
        { id: "edge-1", sourceId: "node-1", targetId: "node-2" },
        { id: "edge-2", sourceId: "node-3", targetId: "node-4" },
        { id: "edge-3", sourceId: "node-4", targetId: "node-5" },
        { id: "edge-4", sourceId: "node-2", targetId: "node-5" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 120, nodeHeight: 48 },
      spacing: { groupGap: 80, minNodeGap: 40, minTargetShift: 20 },
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: -24, bottom: 72 },
      { id: "lane-1", top: 116, bottom: 214 },
      { id: "lane-2", top: 258, bottom: 356 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-1", x: 0, y: 140, width: 120, height: 50 },
      { id: "node-2", x: 20, y: 282, width: 120, height: 50 },
      { id: "node-3", x: 150, y: 140, width: 120, height: 50 },
      { id: "node-4", x: 170, y: 282, width: 120, height: 50 },
      { id: "node-5", x: 300, y: 140, width: 120, height: 50 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-2",
        sourceAnchor: { x: 70, y: 190, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 70, y: 282, side: "top", ordinal: 0 },
        points: [
          { x: 70, y: 190 },
          { x: 70, y: 210 },
          { x: 70, y: 210 },
          { x: 70, y: 282 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "node-3",
        targetId: "node-4",
        sourceAnchor: { x: 220, y: 190, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 220, y: 282, side: "top", ordinal: 0 },
        points: [
          { x: 220, y: 190 },
          { x: 220, y: 210 },
          { x: 220, y: 210 },
          { x: 220, y: 282 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "node-4",
        targetId: "node-5",
        sourceAnchor: { x: 240, y: 282, side: "top", ordinal: 0 },
        targetAnchor: { x: 350, y: 190, side: "bottom", ordinal: 0 },
        points: [
          { x: 240, y: 282 },
          { x: 240, y: 260 },
          { x: 350, y: 260 },
          { x: 350, y: 190 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "node-2",
        targetId: "node-5",
        sourceAnchor: { x: 90, y: 282, side: "top", ordinal: 0 },
        targetAnchor: { x: 340, y: 190, side: "bottom", ordinal: 0 },
        points: [
          { x: 90, y: 282 },
          { x: 90, y: 250 },
          { x: 340, y: 250 },
          { x: 340, y: 190 },
        ],
      },
    ]);
  });

  it('lays out the disconnected security/sign-in/booking model after freezing compact ordering', () => {
    const request: LayoutRequest = {
      nodes: [
        {id: 'node-1', laneId: 'lane-0', width: 180, height: 86},
        {id: 'node-2', laneId: 'lane-1', width: 180, height: 86},
        {id: 'node-3', laneId: 'lane-2', width: 180, height: 86},
        {id: 'node-4', laneId: 'lane-0', width: 180, height: 86},
        {id: 'node-5', laneId: 'lane-1', width: 180, height: 86},
        {id: 'node-6', laneId: 'lane-2', width: 180, height: 86},
        {id: 'node-7', laneId: 'lane-1', width: 180, height: 86},
        {id: 'node-8', laneId: 'lane-0', width: 180, height: 86},
        {id: 'node-9', laneId: 'lane-1', width: 180, height: 86},
      ],
      edges: [
        {id: 'edge-node-1-node-2', sourceId: 'node-1', targetId: 'node-2'},
        {id: 'edge-node-2-node-3', sourceId: 'node-2', targetId: 'node-3'},
        {id: 'edge-node-4-node-5', sourceId: 'node-4', targetId: 'node-5'},
        {id: 'edge-node-5-node-6', sourceId: 'node-5', targetId: 'node-6'},
        {id: 'edge-node-6-node-7', sourceId: 'node-6', targetId: 'node-7'},
        {id: 'edge-node-8-node-9', sourceId: 'node-8', targetId: 'node-9'},
      ],
      lanes: [
        {id: 'lane-0', order: 0},
        {id: 'lane-1', order: 1},
        {id: 'lane-2', order: 2},
      ],
      defaults: {nodeWidth: 120, nodeHeight: 48},
      spacing: {groupGap: 80, minNodeGap: 40, minTargetShift: 20},
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      {id: 'lane-0', top: -24, bottom: 110},
      {id: 'lane-1', top: 154, bottom: 288},
      {id: 'lane-2', top: 332, bottom: 466},
    ]);
    expect(result.result.nodes).toEqual([
      {id: 'node-1', x: 0, y: 0, width: 180, height: 86},
      {id: 'node-2', x: 20, y: 178, width: 180, height: 86},
      {id: 'node-3', x: 40, y: 356, width: 180, height: 86},
      {id: 'node-4', x: 210, y: 0, width: 180, height: 86},
      {id: 'node-5', x: 230, y: 178, width: 180, height: 86},
      {id: 'node-6', x: 250, y: 356, width: 180, height: 86},
      {id: 'node-7', x: 650, y: 178, width: 180, height: 86},
      {id: 'node-8', x: 420, y: 0, width: 180, height: 86},
      {id: 'node-9', x: 440, y: 178, width: 180, height: 86},
    ]);
    expect(result.result.edges).toEqual([
      {
        id: 'edge-node-1-node-2',
        sourceId: 'node-1',
        targetId: 'node-2',
        sourceAnchor: {x: 100, y: 86, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 100, y: 178, side: 'top', ordinal: 0},
        points: [
          {x: 100, y: 86},
          {x: 100, y: 106},
          {x: 100, y: 106},
          {x: 100, y: 178},
        ],
      },
      {
        id: 'edge-node-2-node-3',
        sourceId: 'node-2',
        targetId: 'node-3',
        sourceAnchor: {x: 120, y: 264, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 120, y: 356, side: 'top', ordinal: 0},
        points: [
          {x: 120, y: 264},
          {x: 120, y: 284},
          {x: 120, y: 284},
          {x: 120, y: 356},
        ],
      },
      {
        id: 'edge-node-4-node-5',
        sourceId: 'node-4',
        targetId: 'node-5',
        sourceAnchor: {x: 310, y: 86, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 310, y: 178, side: 'top', ordinal: 0},
        points: [
          {x: 310, y: 86},
          {x: 310, y: 106},
          {x: 310, y: 106},
          {x: 310, y: 178},
        ],
      },
      {
        id: 'edge-node-5-node-6',
        sourceId: 'node-5',
        targetId: 'node-6',
        sourceAnchor: {x: 330, y: 264, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 330, y: 356, side: 'top', ordinal: 0},
        points: [
          {x: 330, y: 264},
          {x: 330, y: 284},
          {x: 330, y: 284},
          {x: 330, y: 356},
        ],
      },
      {
        id: 'edge-node-6-node-7',
        sourceId: 'node-6',
        targetId: 'node-7',
        sourceAnchor: {x: 350, y: 356, side: 'top', ordinal: 0},
        targetAnchor: {x: 730, y: 264, side: 'bottom', ordinal: 0},
        points: [
          {x: 350, y: 356},
          {x: 350, y: 306},
          {x: 730, y: 306},
          {x: 730, y: 264},
        ],
      },
      {
        id: 'edge-node-8-node-9',
        sourceId: 'node-8',
        targetId: 'node-9',
        sourceAnchor: {x: 520, y: 86, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 520, y: 178, side: 'top', ordinal: 0},
        points: [
          {x: 520, y: 86},
          {x: 520, y: 106},
          {x: 520, y: 106},
          {x: 520, y: 178},
        ],
      },
    ]);
  });

  it("support cycle with back-reference edges", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-1", laneId: "lane-0" },
        { id: "node-2", laneId: "lane-1" },
        { id: "node-3", laneId: "lane-1" },
        { id: "node-4", laneId: "lane-2" },
        { id: "node-5", laneId: "lane-2" },
      ],
      edges: [
        { id: "edge-1", sourceId: "node-1", targetId: "node-2" },
        { id: "edge-2", sourceId: "node-2", targetId: "node-3" },
        { id: "edge-3", sourceId: "node-3", targetId: "node-4" },
        { id: "edge-4", sourceId: "node-4", targetId: "node-2", role: "back-reference" },
        { id: "edge-5", sourceId: "node-3", targetId: "node-5" },
        { id: "edge-6", sourceId: "node-5", targetId: "node-2", role: "back-reference" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 120, nodeHeight: 48 },
      spacing: { groupGap: 80, minNodeGap: 40, minTargetShift: 20 },
    };

    const result = compactLayout(request);

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
      { id: "node-2", x: 20, y: 140, width: 120, height: 48 },
      { id: "node-3", x: 200, y: 140, width: 120, height: 48 },
      { id: "node-4", x: 220, y: 280, width: 120, height: 48 },
      { id: "node-5", x: 370, y: 280, width: 120, height: 48 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-1",
        sourceId: "node-1",
        targetId: "node-2",
        sourceAnchor: { x: 70, y: 48, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 70, y: 140, side: "top", ordinal: 0 },
        points: [
          { x: 70, y: 48 },
          { x: 70, y: 68 },
          { x: 70, y: 68 },
          { x: 70, y: 140 },
        ],
      },
      {
        id: "edge-2",
        sourceId: "node-2",
        targetId: "node-3",
        sourceAnchor: { x: 140, y: 160, side: "right", ordinal: 0 },
        targetAnchor: { x: 200, y: 160, side: "left", ordinal: 0 },
        points: [
          { x: 140, y: 160 },
          { x: 160, y: 160 },
          { x: 160, y: 160 },
          { x: 200, y: 160 },
        ],
      },
      {
        id: "edge-3",
        sourceId: "node-3",
        targetId: "node-4",
        sourceAnchor: { x: 270, y: 188, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 270, y: 280, side: "top", ordinal: 0 },
        points: [
          { x: 270, y: 188 },
          { x: 270, y: 218 },
          { x: 270, y: 218 },
          { x: 270, y: 280 },
        ],
      },
      {
        id: "edge-4",
        sourceId: "node-4",
        targetId: "node-2",
        sourceAnchor: { x: 260, y: 280, side: "top", ordinal: 0 },
        targetAnchor: { x: 90, y: 188, side: "bottom", ordinal: 0 },
        points: [
          { x: 260, y: 280 },
          { x: 260, y: 260 },
          { x: 90, y: 260 },
          { x: 90, y: 188 },
        ],
      },
      {
        id: "edge-5",
        sourceId: "node-3",
        targetId: "node-5",
        sourceAnchor: { x: 280, y: 188, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 420, y: 280, side: "top", ordinal: 0 },
        points: [
          { x: 280, y: 188 },
          { x: 280, y: 208 },
          { x: 420, y: 208 },
          { x: 420, y: 280 },
        ],
      },
      {
        id: "edge-6",
        sourceId: "node-5",
        targetId: "node-2",
        sourceAnchor: { x: 410, y: 280, side: "top", ordinal: 0 },
        targetAnchor: { x: 100, y: 188, side: "bottom", ordinal: 0 },
        points: [
          { x: 410, y: 280 },
          { x: 410, y: 250 },
          { x: 100, y: 250 },
          { x: 100, y: 188 },
        ],
      },
    ]);
  });

  it('moves top-lane source nodes closer to their target horizontally', () => {
    const request: LayoutRequest = {
      nodes: [
        {id: 'node-1', laneId: 'lane-0'},
        {id: 'node-2', laneId: 'lane-1'},
        {id: 'node-3', laneId: 'lane-2'},
        {id: 'node-4', laneId: 'lane-1'},
        {id: 'node-5', laneId: 'lane-0'},
        {id: 'node-6', laneId: 'lane-1'},
      ],
      edges: [
        {id: 'edge-1', sourceId: 'node-1', targetId: 'node-2'},
        {id: 'edge-2', sourceId: 'node-2', targetId: 'node-3'},
        {id: 'edge-3', sourceId: 'node-3', targetId: 'node-4'},
        {id: 'edge-4', sourceId: 'node-5', targetId: 'node-6'},
        {id: 'edge-5', sourceId: 'node-4', targetId: 'node-6'},
      ],
      lanes: [
        {id: 'lane-0', order: 0},
        {id: 'lane-1', order: 1},
        {id: 'lane-2', order: 2},
      ],
      defaults: {nodeWidth: 120, nodeHeight: 48},
      spacing: {groupGap: 80, minNodeGap: 40, minTargetShift: 20},
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      {id: 'lane-0', top: -24, bottom: 72},
      {id: 'lane-1', top: 116, bottom: 212},
      {id: 'lane-2', top: 256, bottom: 352},
    ]);
    expect(result.result.nodes).toEqual([
      {id: 'node-1', x: 0, y: 0, width: 120, height: 48},
      {id: 'node-2', x: 20, y: 140, width: 120, height: 48},
      {id: 'node-3', x: 40, y: 280, width: 120, height: 48},
      {id: 'node-4', x: 170, y: 140, width: 120, height: 48},
      {id: 'node-5', x: 330, y: 0, width: 120, height: 48},
      {id: 'node-6', x: 350, y: 140, width: 120, height: 48},
    ]);
    expect(result.result.edges).toEqual([
      {
        id: 'edge-1',
        sourceId: 'node-1',
        targetId: 'node-2',
        sourceAnchor: {x: 70, y: 48, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 70, y: 140, side: 'top', ordinal: 0},
        points: [
          {x: 70, y: 48},
          {x: 70, y: 68},
          {x: 70, y: 68},
          {x: 70, y: 140},
        ],
      },
      {
        id: 'edge-2',
        sourceId: 'node-2',
        targetId: 'node-3',
        sourceAnchor: {x: 90, y: 188, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 90, y: 280, side: 'top', ordinal: 0},
        points: [
          {x: 90, y: 188},
          {x: 90, y: 208},
          {x: 90, y: 208},
          {x: 90, y: 280},
        ],
      },
      {
        id: 'edge-3',
        sourceId: 'node-3',
        targetId: 'node-4',
        sourceAnchor: {x: 110, y: 280, side: 'top', ordinal: 0},
        targetAnchor: {x: 220, y: 188, side: 'bottom', ordinal: 0},
        points: [
          {x: 110, y: 280},
          {x: 110, y: 260},
          {x: 220, y: 260},
          {x: 220, y: 188},
        ],
      },
      {
        id: 'edge-4',
        sourceId: 'node-5',
        targetId: 'node-6',
        sourceAnchor: {x: 400, y: 48, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 400, y: 140, side: 'top', ordinal: 0},
        points: [
          {x: 400, y: 48},
          {x: 400, y: 68},
          {x: 400, y: 68},
          {x: 400, y: 140},
        ],
      },
      {
        id: 'edge-5',
        sourceId: 'node-4',
        targetId: 'node-6',
        sourceAnchor: {x: 290, y: 160, side: 'right', ordinal: 0},
        targetAnchor: {x: 350, y: 160, side: 'left', ordinal: 0},
        points: [
          {x: 290, y: 160},
          {x: 310, y: 160},
          {x: 310, y: 160},
          {x: 350, y: 160},
        ],
      },
    ]);
  });

  it('upward back-reference edges share vertical anchor lanes with downward flow edges', () => {
    const request: LayoutRequest = {
      nodes: [
        {id: 'node-2', laneId: 'lane-1', width: 180, height: 86},
        {id: 'node-3', laneId: 'lane-2', width: 180, height: 86},
        {id: 'node-7', laneId: 'lane-1', width: 180, height: 86},
        {id: 'node-8', laneId: 'lane-2', width: 180, height: 86},
        {id: 'node-9', laneId: 'lane-1', width: 180, height: 86},
      ],
      edges: [
        {id: 'edge-node-2-node-3', sourceId: 'node-2', targetId: 'node-3', role: 'flow'},
        {id: 'edge-node-7-node-2', sourceId: 'node-7', targetId: 'node-2', role: 'flow'},
        {id: 'edge-node-2-node-8', sourceId: 'node-2', targetId: 'node-8', role: 'flow'},
        {id: 'edge-node-3-node-7', sourceId: 'node-3', targetId: 'node-7', role: 'back-reference'},
        {id: 'edge-node-8-node-7', sourceId: 'node-8', targetId: 'node-7', role: 'back-reference'},
        {id: 'edge-node-8-node-9', sourceId: 'node-8', targetId: 'node-9', role: 'flow'},
      ],
      lanes: [
        {id: 'lane-0', order: 0},
        {id: 'lane-1', order: 1},
        {id: 'lane-2', order: 2},
      ],
      defaults: {nodeWidth: 180, nodeHeight: 86},
      spacing: {laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40},
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      {id: 'lane-0', top: 0, bottom: 86},
      {id: 'lane-1', top: 186, bottom: 272},
      {id: 'lane-2', top: 372, bottom: 458},
    ]);
    expect(result.result.nodes).toEqual([
      {id: 'node-2', x: 240, y: 186, width: 180, height: 86},
      {id: 'node-3', x: 260, y: 372, width: 180, height: 86},
      {id: 'node-7', x: 0, y: 186, width: 180, height: 86},
      {id: 'node-8', x: 470, y: 372, width: 180, height: 86},
      {id: 'node-9', x: 490, y: 186, width: 180, height: 86},
    ]);
    expect(result.result.edges).toEqual([
      {
        id: 'edge-node-2-node-3',
        sourceId: 'node-2',
        targetId: 'node-3',
        sourceAnchor: {x: 340, y: 272, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 340, y: 372, side: 'top', ordinal: 0},
        points: [
          {x: 340, y: 272},
          {x: 340, y: 302},
          {x: 340, y: 302},
          {x: 340, y: 372},
        ],
      },
      {
        id: 'edge-node-7-node-2',
        sourceId: 'node-7',
        targetId: 'node-2',
        sourceAnchor: {x: 180, y: 237.0909090909091, side: 'right', ordinal: 0},
        targetAnchor: {x: 240, y: 237.0909090909091, side: 'left', ordinal: 0},
        points: [
          {x: 180, y: 237.0909090909091},
          {x: 200, y: 237.0909090909091},
          {x: 200, y: 237.0909090909091},
          {x: 240, y: 237.0909090909091},
        ],
      },
      {
        id: 'edge-node-2-node-8',
        sourceId: 'node-2',
        targetId: 'node-8',
        sourceAnchor: {x: 350, y: 272, side: 'bottom', ordinal: 0},
        targetAnchor: {x: 550, y: 372, side: 'top', ordinal: 0},
        points: [
          {x: 350, y: 272},
          {x: 350, y: 292},
          {x: 550, y: 292},
          {x: 550, y: 372},
        ],
      },
      {
        id: 'edge-node-3-node-7',
        sourceId: 'node-3',
        targetId: 'node-7',
        role: 'back-reference',
        sourceAnchor: {x: 330, y: 372, side: 'top', ordinal: 0},
        targetAnchor: {x: 100, y: 272, side: 'bottom', ordinal: 0},
        points: [
          {x: 330, y: 372},
          {x: 330, y: 322},
          {x: 100, y: 322},
          {x: 100, y: 272},
        ],
      },
      {
        id: 'edge-node-8-node-7',
        sourceId: 'node-8',
        targetId: 'node-7',
        role: 'back-reference',
        sourceAnchor: {x: 540, y: 372, side: 'top', ordinal: 0},
        targetAnchor: {x: 110, y: 272, side: 'bottom', ordinal: 0},
        points: [
          {x: 540, y: 372},
          {x: 540, y: 310},
          {x: 110, y: 310},
          {x: 110, y: 272},
        ],
      },
      {
        id: 'edge-node-8-node-9',
        sourceId: 'node-8',
        targetId: 'node-9',
        sourceAnchor: {x: 570, y: 372, side: 'top', ordinal: 0},
        targetAnchor: {x: 570, y: 272, side: 'bottom', ordinal: 0},
        points: [
          {x: 570, y: 372},
          {x: 570, y: 312},
          {x: 570, y: 312},
          {x: 570, y: 272},
        ],
      },
    ]);
  });

  it("multiple back-reference edges are sorted to not cross each other", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "node-1", laneId: "lane-0", width: 180, height: 86 },
        { id: "node-2", laneId: "lane-1", width: 180, height: 86 },
        { id: "node-3", laneId: "lane-2", width: 180, height: 86 },
        { id: "node-4", laneId: "lane-0", width: 180, height: 86 },
        { id: "node-5", laneId: "lane-1", width: 180, height: 86 },
        { id: "node-6", laneId: "lane-2", width: 180, height: 86 },
        { id: "node-7", laneId: "lane-1", width: 180, height: 86 },
        { id: "node-8", laneId: "lane-2", width: 180, height: 86 },
        { id: "node-9", laneId: "lane-1", width: 180, height: 86 },
      ],
      edges: [
        { id: "edge-node-1-node-2", sourceId: "node-1", targetId: "node-2", role: "flow" },
        { id: "edge-node-2-node-3", sourceId: "node-2", targetId: "node-3", role: "flow" },
        { id: "edge-node-4-node-5", sourceId: "node-4", targetId: "node-5", role: "flow" },
        { id: "edge-node-5-node-6", sourceId: "node-5", targetId: "node-6", role: "flow" },
        { id: "edge-node-7-node-2", sourceId: "node-7", targetId: "node-2", role: "flow" },
        { id: "edge-node-6-node-7", sourceId: "node-6", targetId: "node-7", role: "flow" },
        { id: "edge-node-2-node-8", sourceId: "node-2", targetId: "node-8", role: "flow" },
        { id: "edge-node-3-node-7", sourceId: "node-3", targetId: "node-7", role: "back-reference" },
        { id: "edge-node-8-node-7", sourceId: "node-8", targetId: "node-7", role: "back-reference" },
        { id: "edge-node-8-node-9", sourceId: "node-8", targetId: "node-9", role: "flow" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 180, nodeHeight: 86 },
      spacing: { laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40 },
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: 0, bottom: 86 },
      { id: "lane-1", top: 186, bottom: 272 },
      { id: "lane-2", top: 372, bottom: 458 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "node-1", x: 450, y: 0, width: 180, height: 86 },
      { id: "node-2", x: 470, y: 186, width: 180, height: 86 },
      { id: "node-3", x: 490, y: 372, width: 180, height: 86 },
      { id: "node-4", x: 0, y: 0, width: 180, height: 86 },
      { id: "node-5", x: 20, y: 186, width: 180, height: 86 },
      { id: "node-6", x: 40, y: 372, width: 180, height: 86 },
      { id: "node-7", x: 230, y: 186, width: 180, height: 86 },
      { id: "node-8", x: 700, y: 372, width: 180, height: 86 },
      { id: "node-9", x: 720, y: 186, width: 180, height: 86 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-node-1-node-2",
        sourceId: "node-1",
        targetId: "node-2",
        sourceAnchor: { x: 550, y: 86, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 550, y: 186, side: "top", ordinal: 0 },
        points: [
          { x: 550, y: 86 },
          { x: 550, y: 106 },
          { x: 550, y: 106 },
          { x: 550, y: 186 },
        ],
      },
      {
        id: "edge-node-2-node-3",
        sourceId: "node-2",
        targetId: "node-3",
        sourceAnchor: { x: 570, y: 272, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 570, y: 372, side: "top", ordinal: 0 },
        points: [
          { x: 570, y: 272 },
          { x: 570, y: 302 },
          { x: 570, y: 302 },
          { x: 570, y: 372 },
        ],
      },
      {
        id: "edge-node-4-node-5",
        sourceId: "node-4",
        targetId: "node-5",
        sourceAnchor: { x: 100, y: 86, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 100, y: 186, side: "top", ordinal: 0 },
        points: [
          { x: 100, y: 86 },
          { x: 100, y: 106 },
          { x: 100, y: 106 },
          { x: 100, y: 186 },
        ],
      },
      {
        id: "edge-node-5-node-6",
        sourceId: "node-5",
        targetId: "node-6",
        sourceAnchor: { x: 120, y: 272, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 120, y: 372, side: "top", ordinal: 0 },
        points: [
          { x: 120, y: 272 },
          { x: 120, y: 292 },
          { x: 120, y: 292 },
          { x: 120, y: 372 },
        ],
      },
      {
        id: "edge-node-7-node-2",
        sourceId: "node-7",
        targetId: "node-2",
        sourceAnchor: { x: 410, y: 237.0909090909091, side: "right", ordinal: 0 },
        targetAnchor: { x: 470, y: 237.0909090909091, side: "left", ordinal: 0 },
        points: [
          { x: 410, y: 237.0909090909091 },
          { x: 430, y: 237.0909090909091 },
          { x: 430, y: 237.0909090909091 },
          { x: 470, y: 237.0909090909091 },
        ],
      },
      {
        id: "edge-node-6-node-7",
        sourceId: "node-6",
        targetId: "node-7",
        sourceAnchor: { x: 140, y: 372, side: "top", ordinal: 0 },
        targetAnchor: { x: 310, y: 272, side: "bottom", ordinal: 0 },
        points: [
          { x: 140, y: 372 },
          { x: 140, y: 322 },
          { x: 310, y: 322 },
          { x: 310, y: 272 },
        ],
      },
      {
        id: "edge-node-2-node-8",
        sourceId: "node-2",
        targetId: "node-8",
        sourceAnchor: { x: 580, y: 272, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 780, y: 372, side: "top", ordinal: 0 },
        points: [
          { x: 580, y: 272 },
          { x: 580, y: 292 },
          { x: 780, y: 292 },
          { x: 780, y: 372 },
        ],
      },
      {
        id: "edge-node-3-node-7",
        sourceId: "node-3",
        targetId: "node-7",
        sourceAnchor: { x: 560, y: 372, side: "top", ordinal: 0 },
        targetAnchor: { x: 330, y: 272, side: "bottom", ordinal: 0 },
        points: [
          { x: 560, y: 372 },
          { x: 560, y: 330 },
          { x: 330, y: 330 },
          { x: 330, y: 272 },
        ],
      },
      {
        id: "edge-node-8-node-7",
        sourceId: "node-8",
        targetId: "node-7",
        sourceAnchor: { x: 770, y: 372, side: "top", ordinal: 0 },
        targetAnchor: { x: 340, y: 272, side: "bottom", ordinal: 0 },
        points: [
          { x: 770, y: 372 },
          { x: 770, y: 320 },
          { x: 340, y: 320 },
          { x: 340, y: 272 },
        ],
      },
      {
        id: "edge-node-8-node-9",
        sourceId: "node-8",
        targetId: "node-9",
        sourceAnchor: { x: 800, y: 372, side: "top", ordinal: 0 },
        targetAnchor: { x: 800, y: 272, side: "bottom", ordinal: 0 },
        points: [
          { x: 800, y: 372 },
          { x: 800, y: 312 },
          { x: 800, y: 312 },
          { x: 800, y: 272 },
        ],
      },
    ]);
  });

  it("tall nodes upward edge bend", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "UI", laneId: "lane-0", width: 230, height: 122 },
        { id: "Command", laneId: "lane-1", width: 230, height: 147 },
        { id: "Event", laneId: "lane-2", width: 230, height: 147 },
        { id: "Read Model", laneId: "lane-1", width: 230, height: 157 },
      ],
      edges: [
        { id: "ui-to-cmd", sourceId: "UI", targetId: "Command", role: "flow" },
        { id: "cmd-to-evt", sourceId: "Command", targetId: "Event", role: "flow" },
        { id: "evt-to-rm", sourceId: "Event", targetId: "Read Model", role: "flow" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 230, nodeHeight: 86 },
      spacing: { laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40 },
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: 0, bottom: 122 },
      { id: "lane-1", top: 222, bottom: 379 },
      { id: "lane-2", top: 479, bottom: 626 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "UI", x: 0, y: 0, width: 230, height: 122 },
      { id: "Command", x: 20, y: 222, width: 230, height: 147 },
      { id: "Event", x: 40, y: 479, width: 230, height: 147 },
      { id: "Read Model", x: 280, y: 222, width: 230, height: 157 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "ui-to-cmd",
        sourceId: "UI",
        targetId: "Command",
        sourceAnchor: { x: 125, y: 122, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 125, y: 222, side: "top", ordinal: 0 },
        points: [
          { x: 125, y: 122 },
          { x: 125, y: 142 },
          { x: 125, y: 142 },
          { x: 125, y: 222 },
        ],
      },
      {
        id: "cmd-to-evt",
        sourceId: "Command",
        targetId: "Event",
        sourceAnchor: { x: 145, y: 369, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 145, y: 479, side: "top", ordinal: 0 },
        points: [
          { x: 145, y: 369 },
          { x: 145, y: 389 },
          { x: 145, y: 389 },
          { x: 145, y: 479 },
        ],
      },
      {
        id: "evt-to-rm",
        sourceId: "Event",
        targetId: "Read Model",
        sourceAnchor: { x: 165, y: 479, side: "top", ordinal: 0 },
        targetAnchor: { x: 385, y: 379, side: "bottom", ordinal: 0 },
        points: [
          { x: 165, y: 479 },
          { x: 165, y: 430 },
          { x: 385, y: 430 },
          { x: 385, y: 379 },
        ],
      },
    ]);
  });

  it("1 command -> 2 events -> 2 read models", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "n-new-project-modal", laneId: "lane-0", width: 240, height: 100 },
        { id: "n-add-project", laneId: "lane-1", width: 240, height: 96 },
        { id: "n-pm-project-added", laneId: "lane-2", width: 240, height: 122 },
        { id: "n-pm-chapter-added", laneId: "lane-2", width: 240, height: 147 },
        { id: "n-pm-workspace-rm", laneId: "lane-1", width: 240, height: 180 },
        { id: "n-pm-active-scope-rm", laneId: "lane-1", width: 240, height: 122 },
      ],
      edges: [
        { id: "edge-n-new-project-modal-n-add-project", sourceId: "n-new-project-modal", targetId: "n-add-project", role: "flow" },
        { id: "edge-n-add-project-n-pm-project-added", sourceId: "n-add-project", targetId: "n-pm-project-added", role: "flow" },
        { id: "edge-n-add-project-n-pm-chapter-added", sourceId: "n-add-project", targetId: "n-pm-chapter-added", role: "flow" },
        { id: "edge-n-pm-project-added-n-pm-active-scope-rm", sourceId: "n-pm-project-added", targetId: "n-pm-active-scope-rm", role: "flow" },
        { id: "edge-n-pm-project-added-n-pm-workspace-rm", sourceId: "n-pm-project-added", targetId: "n-pm-workspace-rm", role: "flow" },
        { id: "edge-n-pm-chapter-added-n-pm-active-scope-rm", sourceId: "n-pm-chapter-added", targetId: "n-pm-active-scope-rm", role: "flow" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 230, nodeHeight: 86 },
      spacing: { laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40 },
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: 0, bottom: 100 },
      { id: "lane-1", top: 200, bottom: 380 },
      { id: "lane-2", top: 480, bottom: 627 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "n-new-project-modal", x: 0, y: 0, width: 240, height: 100 },
      { id: "n-add-project", x: 20, y: 200, width: 240, height: 96 },
      { id: "n-pm-project-added", x: 40, y: 480, width: 240, height: 122 },
      { id: "n-pm-chapter-added", x: 310, y: 480, width: 240, height: 147 },
      { id: "n-pm-workspace-rm", x: 290, y: 200, width: 240, height: 180 },
      { id: "n-pm-active-scope-rm", x: 560, y: 200, width: 240, height: 122 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-n-new-project-modal-n-add-project",
        sourceId: "n-new-project-modal",
        targetId: "n-add-project",
        sourceAnchor: { x: 130, y: 100, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 130, y: 200, side: "top", ordinal: 0 },
        points: [
          { x: 130, y: 100 },
          { x: 130, y: 120 },
          { x: 130, y: 120 },
          { x: 130, y: 200 },
        ],
      },
      {
        id: "edge-n-add-project-n-pm-project-added",
        sourceId: "n-add-project",
        targetId: "n-pm-project-added",
        sourceAnchor: { x: 150, y: 296, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 150, y: 480, side: "top", ordinal: 0 },
        points: [
          { x: 150, y: 296 },
          { x: 150, y: 326 },
          { x: 150, y: 326 },
          { x: 150, y: 480 },
        ],
      },
      {
        id: "edge-n-add-project-n-pm-chapter-added",
        sourceId: "n-add-project",
        targetId: "n-pm-chapter-added",
        sourceAnchor: { x: 160, y: 296, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 420, y: 480, side: "top", ordinal: 0 },
        points: [
          { x: 160, y: 296 },
          { x: 160, y: 430 },
          { x: 420, y: 430 },
          { x: 420, y: 480 },
        ],
      },
      {
        id: "edge-n-pm-project-added-n-pm-active-scope-rm",
        sourceId: "n-pm-project-added",
        targetId: "n-pm-active-scope-rm",
        sourceAnchor: { x: 180, y: 480, side: "top", ordinal: 0 },
        targetAnchor: { x: 660, y: 322, side: "bottom", ordinal: 0 },
        points: [
          { x: 180, y: 480 },
          { x: 180, y: 420 },
          { x: 660, y: 420 },
          { x: 660, y: 322 },
        ],
      },
      {
        id: "edge-n-pm-project-added-n-pm-workspace-rm",
        sourceId: "n-pm-project-added",
        targetId: "n-pm-workspace-rm",
        sourceAnchor: { x: 170, y: 480, side: "top", ordinal: 0 },
        targetAnchor: { x: 400, y: 380, side: "bottom", ordinal: 0 },
        points: [
          { x: 170, y: 480 },
          { x: 170, y: 410 },
          { x: 400, y: 410 },
          { x: 400, y: 380 },
        ],
      },
      {
        id: "edge-n-pm-chapter-added-n-pm-active-scope-rm",
        sourceId: "n-pm-chapter-added",
        targetId: "n-pm-active-scope-rm",
        sourceAnchor: { x: 440, y: 480, side: "top", ordinal: 0 },
        targetAnchor: { x: 670, y: 322, side: "bottom", ordinal: 0 },
        points: [
          { x: 440, y: 480 },
          { x: 440, y: 430 },
          { x: 670, y: 430 },
          { x: 670, y: 322 },
        ],
      },
    ]);
  });

  it("upwards fan-in edge crossing downwards edge layout", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "n-app-loaded", laneId: "lane-0", width: 230, height: 86 },
        { id: "n-ensure-workspace", laneId: "lane-1", width: 230, height: 86 },
        { id: "n-init-project-added", laneId: "lane-2", width: 230, height: 118 },
        { id: "n-init-chapter-added", laneId: "lane-2", width: 240, height: 143 },
        { id: "n-workspace-rm", laneId: "lane-1", width: 240, height: 152 },
      ],
      edges: [
        { id: "edge-n-app-loaded-n-ensure-workspace", sourceId: "n-app-loaded", targetId: "n-ensure-workspace", role: "flow" },
        { id: "edge-n-ensure-workspace-n-init-project-added", sourceId: "n-ensure-workspace", targetId: "n-init-project-added", role: "flow" },
        { id: "edge-n-ensure-workspace-n-init-chapter-added", sourceId: "n-ensure-workspace", targetId: "n-init-chapter-added", role: "flow" },
        { id: "edge-n-init-chapter-added-n-workspace-rm", sourceId: "n-init-chapter-added", targetId: "n-workspace-rm", role: "back-reference" },
        { id: "edge-n-init-project-added-n-workspace-rm", sourceId: "n-init-project-added", targetId: "n-workspace-rm", role: "flow" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 230, nodeHeight: 86 },
      spacing: { laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40 },
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: 0, bottom: 86 },
      { id: "lane-1", top: 186, bottom: 338 },
      { id: "lane-2", top: 438, bottom: 581 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "n-app-loaded", x: 0, y: 0, width: 230, height: 86 },
      { id: "n-ensure-workspace", x: 20, y: 186, width: 230, height: 86 },
      { id: "n-init-project-added", x: 40, y: 438, width: 230, height: 118 },
      { id: "n-init-chapter-added", x: 300, y: 438, width: 240, height: 143 },
      { id: "n-workspace-rm", x: 280, y: 186, width: 240, height: 152 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-n-app-loaded-n-ensure-workspace",
        sourceId: "n-app-loaded",
        targetId: "n-ensure-workspace",
        sourceAnchor: { x: 125, y: 86, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 125, y: 186, side: "top", ordinal: 0 },
        points: [
          { x: 125, y: 86 },
          { x: 125, y: 106 },
          { x: 125, y: 106 },
          { x: 125, y: 186 },
        ],
      },
      {
        id: "edge-n-ensure-workspace-n-init-project-added",
        sourceId: "n-ensure-workspace",
        targetId: "n-init-project-added",
        sourceAnchor: { x: 145, y: 272, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 145, y: 438, side: "top", ordinal: 0 },
        points: [
          { x: 145, y: 272 },
          { x: 145, y: 302 },
          { x: 145, y: 302 },
          { x: 145, y: 438 },
        ],
      },
      {
        id: "edge-n-ensure-workspace-n-init-chapter-added",
        sourceId: "n-ensure-workspace",
        targetId: "n-init-chapter-added",
        sourceAnchor: { x: 155, y: 272, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 400, y: 438, side: "top", ordinal: 0 },
        points: [
          { x: 155, y: 272 },
          { x: 155, y: 360 },
          { x: 400, y: 360 },
          { x: 400, y: 438 },
        ],
      },
      {
        id: "edge-n-init-chapter-added-n-workspace-rm",
        sourceId: "n-init-chapter-added",
        targetId: "n-workspace-rm",
        sourceAnchor: { x: 430, y: 438, side: "top", ordinal: 0 },
        targetAnchor: { x: 430, y: 338, side: "bottom", ordinal: 0 },
        points: [
          { x: 430, y: 438 },
          { x: 430, y: 390 },
          { x: 430, y: 390 },
          { x: 430, y: 338 },
        ],
      },
      {
        id: "edge-n-init-project-added-n-workspace-rm",
        sourceId: "n-init-project-added",
        targetId: "n-workspace-rm",
        sourceAnchor: { x: 165, y: 438, side: "top", ordinal: 0 },
        targetAnchor: { x: 420, y: 338, side: "bottom", ordinal: 0 },
        points: [
          { x: 165, y: 438 },
          { x: 165, y: 390 },
          { x: 420, y: 390 },
          { x: 420, y: 338 },
        ],
      },
    ]);
  });

  it("multi fan-in combined with multi fan-out", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "n-new-project-modal", laneId: "lane-0", width: 230, height: 96 },
        { id: "n-add-project", laneId: "lane-1", width: 230, height: 96 },
        { id: "n-pm-project-added", laneId: "lane-2", width: 230, height: 122 },
        { id: "n-pm-chapter-added", laneId: "lane-2", width: 230, height: 147 },
        { id: "n-pm-workspace-rm", laneId: "lane-1", width: 230, height: 181 },
        { id: "n-pm-active-scope-rm", laneId: "lane-1", width: 230, height: 122 },
      ],
      edges: [
        { id: "edge-n-new-project-modal-n-add-project", sourceId: "n-new-project-modal", targetId: "n-add-project", role: "flow" },
        { id: "edge-n-add-project-n-pm-project-added", sourceId: "n-add-project", targetId: "n-pm-project-added", role: "flow" },
        { id: "edge-n-add-project-n-pm-chapter-added", sourceId: "n-add-project", targetId: "n-pm-chapter-added", role: "flow" },
        { id: "edge-n-pm-project-added-n-pm-active-scope-rm", sourceId: "n-pm-project-added", targetId: "n-pm-active-scope-rm", role: "flow" },
        { id: "edge-n-pm-project-added-n-pm-workspace-rm", sourceId: "n-pm-project-added", targetId: "n-pm-workspace-rm", role: "flow" },
        { id: "edge-n-pm-chapter-added-n-pm-active-scope-rm", sourceId: "n-pm-chapter-added", targetId: "n-pm-active-scope-rm", role: "flow" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 230, nodeHeight: 86 },
      spacing: { laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40 },
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: 0, bottom: 96 },
      { id: "lane-1", top: 196, bottom: 377 },
      { id: "lane-2", top: 477, bottom: 624 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "n-new-project-modal", x: 0, y: 0, width: 230, height: 96 },
      { id: "n-add-project", x: 20, y: 196, width: 230, height: 96 },
      { id: "n-pm-project-added", x: 40, y: 477, width: 230, height: 122 },
      { id: "n-pm-chapter-added", x: 300, y: 477, width: 230, height: 147 },
      { id: "n-pm-workspace-rm", x: 280, y: 196, width: 230, height: 181 },
      { id: "n-pm-active-scope-rm", x: 540, y: 196, width: 230, height: 122 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-n-new-project-modal-n-add-project",
        sourceId: "n-new-project-modal",
        targetId: "n-add-project",
        sourceAnchor: { x: 125, y: 96, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 125, y: 196, side: "top", ordinal: 0 },
        points: [
          { x: 125, y: 96 },
          { x: 125, y: 116 },
          { x: 125, y: 116 },
          { x: 125, y: 196 },
        ],
      },
      {
        id: "edge-n-add-project-n-pm-project-added",
        sourceId: "n-add-project",
        targetId: "n-pm-project-added",
        sourceAnchor: { x: 145, y: 292, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 145, y: 477, side: "top", ordinal: 0 },
        points: [
          { x: 145, y: 292 },
          { x: 145, y: 322 },
          { x: 145, y: 322 },
          { x: 145, y: 477 },
        ],
      },
      {
        id: "edge-n-add-project-n-pm-chapter-added",
        sourceId: "n-add-project",
        targetId: "n-pm-chapter-added",
        sourceAnchor: { x: 155, y: 292, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 405, y: 477, side: "top", ordinal: 0 },
        points: [
          { x: 155, y: 292 },
          { x: 155, y: 430 },
          { x: 405, y: 430 },
          { x: 405, y: 477 },
        ],
      },
      {
        id: "edge-n-pm-project-added-n-pm-active-scope-rm",
        sourceId: "n-pm-project-added",
        targetId: "n-pm-active-scope-rm",
        sourceAnchor: { x: 175, y: 477, side: "top", ordinal: 0 },
        targetAnchor: { x: 635, y: 318, side: "bottom", ordinal: 0 },
        points: [
          { x: 175, y: 477 },
          { x: 175, y: 420 },
          { x: 635, y: 420 },
          { x: 635, y: 318 },
        ],
      },
      {
        id: "edge-n-pm-project-added-n-pm-workspace-rm",
        sourceId: "n-pm-project-added",
        targetId: "n-pm-workspace-rm",
        sourceAnchor: { x: 165, y: 477, side: "top", ordinal: 0 },
        targetAnchor: { x: 385, y: 377, side: "bottom", ordinal: 0 },
        points: [
          { x: 165, y: 477 },
          { x: 165, y: 410 },
          { x: 385, y: 410 },
          { x: 385, y: 377 },
        ],
      },
      {
        id: "edge-n-pm-chapter-added-n-pm-active-scope-rm",
        sourceId: "n-pm-chapter-added",
        targetId: "n-pm-active-scope-rm",
        sourceAnchor: { x: 425, y: 477, side: "top", ordinal: 0 },
        targetAnchor: { x: 645, y: 318, side: "bottom", ordinal: 0 },
        points: [
          { x: 425, y: 477 },
          { x: 425, y: 430 },
          { x: 645, y: 430 },
          { x: 645, y: 318 },
        ],
      },
    ]);
  });

  it("2x2 fan-in and fan-out", () => {
    const request: LayoutRequest = {
      nodes: [
        { id: "n-switcher", laneId: "lane-0", width: 230, height: 86 },
        { id: "n-new-project-modal", laneId: "lane-0", width: 230, height: 96 },
        { id: "n-add-project", laneId: "lane-1", width: 230, height: 96 },
        { id: "n-pm-project-added", laneId: "lane-2", width: 230, height: 122 },
        { id: "n-pm-chapter-added", laneId: "lane-2", width: 230, height: 147 },
        { id: "n-pm-workspace-rm", laneId: "lane-1", width: 230, height: 181 },
        { id: "n-pm-active-scope-rm", laneId: "lane-1", width: 230, height: 122 },
      ],
      edges: [
        { id: "edge-n-switcher-n-new-project-modal", sourceId: "n-switcher", targetId: "n-new-project-modal", role: "flow" },
        { id: "edge-n-new-project-modal-n-add-project", sourceId: "n-new-project-modal", targetId: "n-add-project", role: "flow" },
        { id: "edge-n-add-project-n-pm-project-added", sourceId: "n-add-project", targetId: "n-pm-project-added", role: "flow" },
        { id: "edge-n-add-project-n-pm-chapter-added", sourceId: "n-add-project", targetId: "n-pm-chapter-added", role: "flow" },
        { id: "edge-n-pm-chapter-added-n-pm-workspace-rm", sourceId: "n-pm-chapter-added", targetId: "n-pm-workspace-rm", role: "back-reference" },
        { id: "edge-n-pm-chapter-added-n-pm-active-scope-rm", sourceId: "n-pm-chapter-added", targetId: "n-pm-active-scope-rm", role: "back-reference" },
        { id: "edge-n-pm-project-added-n-pm-workspace-rm", sourceId: "n-pm-project-added", targetId: "n-pm-workspace-rm", role: "flow" },
        { id: "edge-n-pm-project-added-n-pm-active-scope-rm", sourceId: "n-pm-project-added", targetId: "n-pm-active-scope-rm", role: "flow" },
      ],
      lanes: [
        { id: "lane-0", order: 0 },
        { id: "lane-1", order: 1 },
        { id: "lane-2", order: 2 },
      ],
      defaults: { nodeWidth: 230, nodeHeight: 86 },
      spacing: { laneMargin: 0, laneGap: 100, minTargetShift: 20, minNodeGap: 40 },
    };

    const result = compactLayout(request);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.result.lanes).toEqual([
      { id: "lane-0", top: 0, bottom: 96 },
      { id: "lane-1", top: 196, bottom: 377 },
      { id: "lane-2", top: 477, bottom: 624 },
    ]);
    expect(result.result.nodes).toEqual([
      { id: "n-switcher", x: 0, y: 0, width: 230, height: 86 },
      { id: "n-new-project-modal", x: 290, y: 0, width: 230, height: 96 },
      { id: "n-add-project", x: 310, y: 196, width: 230, height: 96 },
      { id: "n-pm-project-added", x: 330, y: 477, width: 230, height: 122 },
      { id: "n-pm-chapter-added", x: 590, y: 477, width: 230, height: 147 },
      { id: "n-pm-workspace-rm", x: 570, y: 196, width: 230, height: 181 },
      { id: "n-pm-active-scope-rm", x: 830, y: 196, width: 230, height: 122 },
    ]);
    expect(result.result.edges).toEqual([
      {
        id: "edge-n-switcher-n-new-project-modal",
        sourceId: "n-switcher",
        targetId: "n-new-project-modal",
        sourceAnchor: { x: 230, y: 51.09090909090909, side: "right", ordinal: 0 },
        targetAnchor: { x: 290, y: 59.27272727272727, side: "left", ordinal: 0 },
        points: [
          { x: 230, y: 51.09090909090909 },
          { x: 250, y: 51.09090909090909 },
          { x: 250, y: 59.27272727272727 },
          { x: 290, y: 59.27272727272727 },
        ],
      },
      {
        id: "edge-n-new-project-modal-n-add-project",
        sourceId: "n-new-project-modal",
        targetId: "n-add-project",
        sourceAnchor: { x: 415, y: 96, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 415, y: 196, side: "top", ordinal: 0 },
        points: [
          { x: 415, y: 96 },
          { x: 415, y: 116 },
          { x: 415, y: 116 },
          { x: 415, y: 196 },
        ],
      },
      {
        id: "edge-n-add-project-n-pm-project-added",
        sourceId: "n-add-project",
        targetId: "n-pm-project-added",
        sourceAnchor: { x: 435, y: 292, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 435, y: 477, side: "top", ordinal: 0 },
        points: [
          { x: 435, y: 292 },
          { x: 435, y: 322 },
          { x: 435, y: 322 },
          { x: 435, y: 477 },
        ],
      },
      {
        id: "edge-n-add-project-n-pm-chapter-added",
        sourceId: "n-add-project",
        targetId: "n-pm-chapter-added",
        sourceAnchor: { x: 445, y: 292, side: "bottom", ordinal: 0 },
        targetAnchor: { x: 685, y: 477, side: "top", ordinal: 0 },
        points: [
          { x: 445, y: 292 },
          { x: 445, y: 400 },
          { x: 685, y: 400 },
          { x: 685, y: 477 },
        ],
      },
      {
        id: "edge-n-pm-chapter-added-n-pm-workspace-rm",
        sourceId: "n-pm-chapter-added",
        targetId: "n-pm-workspace-rm",
        sourceAnchor: { x: 715, y: 477, side: "top", ordinal: 0 },
        targetAnchor: { x: 715, y: 377, side: "bottom", ordinal: 0 },
        points: [
          { x: 715, y: 477 },
          { x: 715, y: 410 },
          { x: 715, y: 410 },
          { x: 715, y: 377 },
        ],
      },
      {
        id: "edge-n-pm-chapter-added-n-pm-active-scope-rm",
        sourceId: "n-pm-chapter-added",
        targetId: "n-pm-active-scope-rm",
        sourceAnchor: { x: 725, y: 477, side: "top", ordinal: 0 },
        targetAnchor: { x: 935, y: 318, side: "bottom", ordinal: 0 },
        points: [
          { x: 725, y: 477 },
          { x: 725, y: 430 },
          { x: 935, y: 430 },
          { x: 935, y: 318 },
        ],
      },
      {
        id: "edge-n-pm-project-added-n-pm-workspace-rm",
        sourceId: "n-pm-project-added",
        targetId: "n-pm-workspace-rm",
        sourceAnchor: { x: 455, y: 477, side: "top", ordinal: 0 },
        targetAnchor: { x: 705, y: 377, side: "bottom", ordinal: 0 },
        points: [
          { x: 455, y: 477 },
          { x: 455, y: 410 },
          { x: 705, y: 410 },
          { x: 705, y: 377 },
        ],
      },
      {
        id: "edge-n-pm-project-added-n-pm-active-scope-rm",
        sourceId: "n-pm-project-added",
        targetId: "n-pm-active-scope-rm",
        sourceAnchor: { x: 465, y: 477, side: "top", ordinal: 0 },
        targetAnchor: { x: 925, y: 318, side: "bottom", ordinal: 0 },
        points: [
          { x: 465, y: 477 },
          { x: 465, y: 420 },
          { x: 925, y: 420 },
          { x: 925, y: 318 },
        ],
      },
    ]);
  });

});