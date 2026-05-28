import {describe, expect, it} from "vitest";
import {compactLayout} from "./compactLayout";
import type {LayoutRequest} from "./types";

describe("compactLayout acceptance", () => {
    it("lays out 8 nodes across lane-0, lane-1, lane-2 (original)", () => {
        const request: LayoutRequest = {
            nodes: [
                {id: "Enter Booking", laneId: "lane-0", width: 120, height: 70},
                {id: "Add Booking", laneId: "lane-1", width: 120, height: 70},
                {id: "Tentative Booking Added", laneId: "lane-2", width: 120, height: 70},
                {id: "Tentative Bookings", laneId: "lane-1", width: 120, height: 70},
                {id: "Confirm Screen", laneId: "lane-0", width: 120, height: 70},
                {id: "Confirm Booking", laneId: "lane-1", width: 120, height: 70},
                {id: "Is Booking Tentative", laneId: "lane-1", width: 120, height: 70},
                {id: "Booking Confirmed", laneId: "lane-2", width: 120, height: 70},
            ],
            edges: [
                {id: "edge-1", sourceId: "Enter Booking", targetId: "Add Booking"},
                {id: "edge-2", sourceId: "Add Booking", targetId: "Tentative Booking Added"},
                {id: "edge-3", sourceId: "Tentative Booking Added", targetId: "Tentative Bookings"},
                {id: "edge-4", sourceId: "Tentative Bookings", targetId: "Confirm Screen"},
                {id: "edge-5", sourceId: "Confirm Screen", targetId: "Confirm Booking"},
                {id: "edge-6", sourceId: "Tentative Booking Added", targetId: "Is Booking Tentative"},
                {id: "edge-8", sourceId: "Confirm Booking", targetId: "Booking Confirmed"},
                {id: "edge-7", sourceId: "Is Booking Tentative", targetId: "Confirm Booking"},
            ],
            lanes: [
                {id: "lane-0", order: 0},
                {id: "lane-1", order: 1},
                {id: "lane-2", order: 2},
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
            {id: "lane-0", top: -24, bottom: 94},
            {id: "lane-1", top: 138, bottom: 256},
            {id: "lane-2", top: 300, bottom: 418},
        ]);
        expect(result.result.nodes).toEqual([
            {id: "Enter Booking", x: 0, y: 0, width: 120, height: 70},
            {id: "Add Booking", x: 20, y: 162, width: 120, height: 70},
            {id: "Tentative Booking Added", x: 40, y: 324, width: 120, height: 70},
            {id: "Tentative Bookings", x: 170, y: 162, width: 120, height: 70},
            {id: "Confirm Screen", x: 190, y: 0, width: 120, height: 70},
            {id: "Confirm Booking", x: 500, y: 162, width: 120, height: 70},
            {id: "Is Booking Tentative", x: 320, y: 162, width: 120, height: 70},
            {id: "Booking Confirmed", x: 520, y: 324, width: 120, height: 70},
        ]);
        expect(result.result.edges).toEqual([
            {
                id: "edge-1",
                sourceId: "Enter Booking",
                targetId: "Add Booking",
                sourceAnchor: {x: 70, y: 70, side: "bottom", ordinal: 0},
                targetAnchor: {x: 70, y: 162, side: "top", ordinal: 0},
                points: [
                    {x: 70, y: 70},
                    {x: 70, y: 90},
                    {x: 70, y: 90},
                    {x: 70, y: 162},
                ],
            },
            {
                id: "edge-2",
                sourceId: "Add Booking",
                targetId: "Tentative Booking Added",
                sourceAnchor: {x: 90, y: 232, side: "bottom", ordinal: 0},
                targetAnchor: {x: 90, y: 324, side: "top", ordinal: 0},
                points: [
                    {x: 90, y: 232},
                    {x: 90, y: 252},
                    {x: 90, y: 252},
                    {x: 90, y: 324},
                ],
            },
            {
                id: "edge-3",
                sourceId: "Tentative Booking Added",
                targetId: "Tentative Bookings",
                sourceAnchor: {x: 110, y: 324, side: "top", ordinal: 0},
                targetAnchor: {x: 220, y: 232, side: "bottom", ordinal: 0},
                points: [
                    {x: 110, y: 324},
                    {x: 110, y: 270},
                    {x: 220, y: 270},
                    {x: 220, y: 232},
                ],
            },
            {
                id: "edge-4",
                sourceId: "Tentative Bookings",
                targetId: "Confirm Screen",
                sourceAnchor: {x: 240, y: 162, side: "top", ordinal: 0},
                targetAnchor: {x: 240, y: 70, side: "bottom", ordinal: 0},
                points: [
                    {x: 240, y: 162},
                    {x: 240, y: 90},
                    {x: 240, y: 90},
                    {x: 240, y: 70},
                ],
            },
            {
                id: "edge-5",
                sourceId: "Confirm Screen",
                targetId: "Confirm Booking",
                sourceAnchor: {x: 260, y: 70, side: "bottom", ordinal: 0},
                targetAnchor: {x: 550, y: 162, side: "top", ordinal: 0},
                points: [
                    {x: 260, y: 70},
                    {x: 260, y: 90},
                    {x: 550, y: 90},
                    {x: 550, y: 162},
                ],
            },
            {
                id: "edge-6",
                sourceId: "Tentative Booking Added",
                targetId: "Is Booking Tentative",
                sourceAnchor: {x: 120, y: 324, side: "top", ordinal: 0},
                targetAnchor: {x: 370, y: 232, side: "bottom", ordinal: 0},
                points: [
                    {x: 120, y: 324},
                    {x: 120, y: 280},
                    {x: 370, y: 280},
                    {x: 370, y: 232},
                ],
            },
            {
                id: "edge-8",
                sourceId: "Confirm Booking",
                targetId: "Booking Confirmed",
                sourceAnchor: {x: 570, y: 232, side: "bottom", ordinal: 0},
                targetAnchor: {x: 570, y: 324, side: "top", ordinal: 0},
                points: [
                    {x: 570, y: 232},
                    {x: 570, y: 252},
                    {x: 570, y: 252},
                    {x: 570, y: 324},
                ],
            },
            {
                id: "edge-7",
                sourceId: "Is Booking Tentative",
                targetId: "Confirm Booking",
                sourceAnchor: {x: 440, y: 200, side: "right", ordinal: 0},
                targetAnchor: {x: 500, y: 200, side: "left", ordinal: 0},
                points: [
                    {x: 440, y: 200},
                    {x: 460, y: 200},
                    {x: 460, y: 200},
                    {x: 500, y: 200},
                ],
            },
        ]);
    });

    it("Source anchor points for down-edges are to the right of the node center", () => {
        const request: LayoutRequest = {
            nodes: [
                {id: "node-1", laneId: "lane-0", width: 220, height: 50},
                {id: "node-2", laneId: "lane-1"},
                {id: "node-3", laneId: "lane-0"},
            ],
            edges: [
                {id: "edge-1", sourceId: "node-1", targetId: "node-2"},
                {id: "edge-2", sourceId: "node-2", targetId: "node-3"},
            ],
            lanes: [
                {id: "lane-0", order: 0},
                {id: "lane-1", order: 1},
                {id: "lane-2", order: 2},
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
            {id: "lane-0", top: -24, bottom: 74},
            {id: "lane-1", top: 118, bottom: 214},
            {id: "lane-2", top: 258, bottom: 354},
        ]);
        expect(result.result.nodes).toEqual([
            {id: "node-1", x: 0, y: 0, width: 220, height: 50},
            {id: "node-2", x: 70, y: 142, width: 120, height: 48},
            {id: "node-3", x: 250, y: 0, width: 120, height: 48},
        ]);
        expect(result.result.edges).toEqual([
            {
                id: "edge-1",
                sourceId: "node-1",
                targetId: "node-2",
                sourceAnchor: {x: 120, y: 50, side: "bottom", ordinal: 0},
                targetAnchor: {x: 120, y: 142, side: "top", ordinal: 0},
                points: [
                    {x: 120, y: 50},
                    {x: 120, y: 70},
                    {x: 120, y: 70},
                    {x: 120, y: 142},
                ],
            },
            {
                id: "edge-2",
                sourceId: "node-2",
                targetId: "node-3",
                sourceAnchor: {x: 140, y: 142, side: "top", ordinal: 0},
                targetAnchor: {x: 300, y: 48, side: "bottom", ordinal: 0},
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
                {id: "Enter Booking", laneId: "lane-0"},
                {id: "Add Booking", laneId: "lane-1"},
                {id: "Tentative Booking Added", laneId: "lane-2"},
                {id: "Tentative Bookings", laneId: "lane-1"},
                {id: "Confirm Screen", laneId: "lane-0"},
                {id: "Confirm Booking", laneId: "lane-1"},
                {id: "Is Booking Tentative", laneId: "lane-1"},
                {id: "Booking Confirmed", laneId: "lane-2"},
            ],
            edges: [
                {id: "edge-1", sourceId: "Enter Booking", targetId: "Add Booking"},
                {id: "edge-2", sourceId: "Add Booking", targetId: "Tentative Booking Added"},
                {id: "edge-3", sourceId: "Tentative Booking Added", targetId: "Tentative Bookings"},
                {id: "edge-4", sourceId: "Tentative Bookings", targetId: "Confirm Screen"},
                {id: "edge-5", sourceId: "Confirm Screen", targetId: "Confirm Booking"},
                {id: "edge-6", sourceId: "Tentative Booking Added", targetId: "Is Booking Tentative"},
                {id: "edge-7", sourceId: "Is Booking Tentative", targetId: "Confirm Booking"},
                {id: "edge-8", sourceId: "Confirm Booking", targetId: "Booking Confirmed"},
            ],
            lanes: [
                {id: "lane-0", order: 0},
                {id: "lane-1", order: 1},
                {id: "lane-2", order: 2},
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
            {id: "lane-0", top: -24, bottom: 72},
            {id: "lane-1", top: 116, bottom: 212},
            {id: "lane-2", top: 256, bottom: 352},
        ]);
        expect(result.result.nodes).toEqual([
            {id: "Enter Booking", x: 0, y: 0, width: 120, height: 48},
            {id: "Add Booking", x: 20, y: 140, width: 120, height: 48},
            {id: "Tentative Booking Added", x: 40, y: 280, width: 120, height: 48},
            {id: "Tentative Bookings", x: 170, y: 140, width: 120, height: 48},
            {id: "Confirm Screen", x: 190, y: 0, width: 120, height: 48},
            {id: "Confirm Booking", x: 500, y: 140, width: 120, height: 48},
            {id: "Is Booking Tentative", x: 320, y: 140, width: 120, height: 48},
            {id: "Booking Confirmed", x: 520, y: 280, width: 120, height: 48},
        ]);
        expect(result.result.edges).toEqual([
            {
                id: "edge-1",
                sourceId: "Enter Booking",
                targetId: "Add Booking",
                sourceAnchor: {x: 70, y: 48, side: "bottom", ordinal: 0},
                targetAnchor: {x: 70, y: 140, side: "top", ordinal: 0},
                points: [
                    {x: 70, y: 48},
                    {x: 70, y: 68},
                    {x: 70, y: 68},
                    {x: 70, y: 140},
                ],
            },
            {
                id: "edge-2",
                sourceId: "Add Booking",
                targetId: "Tentative Booking Added",
                sourceAnchor: {x: 90, y: 188, side: "bottom", ordinal: 0},
                targetAnchor: {x: 90, y: 280, side: "top", ordinal: 0},
                points: [
                    {x: 90, y: 188},
                    {x: 90, y: 208},
                    {x: 90, y: 208},
                    {x: 90, y: 280},
                ],
            },
            {
                id: "edge-3",
                sourceId: "Tentative Booking Added",
                targetId: "Tentative Bookings",
                sourceAnchor: {x: 110, y: 280, side: "top", ordinal: 0},
                targetAnchor: {x: 220, y: 188, side: "bottom", ordinal: 0},
                points: [
                    {x: 110, y: 280},
                    {x: 110, y: 240},
                    {x: 220, y: 240},
                    {x: 220, y: 188},
                ],
            },
            {
                id: "edge-4",
                sourceId: "Tentative Bookings",
                targetId: "Confirm Screen",
                sourceAnchor: {x: 240, y: 140, side: "top", ordinal: 0},
                targetAnchor: {x: 240, y: 48, side: "bottom", ordinal: 0},
                points: [
                    {x: 240, y: 140},
                    {x: 240, y: 90},
                    {x: 240, y: 90},
                    {x: 240, y: 48},
                ],
            },
            {
                id: "edge-5",
                sourceId: "Confirm Screen",
                targetId: "Confirm Booking",
                sourceAnchor: {x: 260, y: 48, side: "bottom", ordinal: 0},
                targetAnchor: {x: 550, y: 140, side: "top", ordinal: 0},
                points: [
                    {x: 260, y: 48},
                    {x: 260, y: 68},
                    {x: 550, y: 68},
                    {x: 550, y: 140},
                ],
            },
            {
                id: "edge-6",
                sourceId: "Tentative Booking Added",
                targetId: "Is Booking Tentative",
                sourceAnchor: {x: 120, y: 280, side: "top", ordinal: 0},
                targetAnchor: {x: 360, y: 188, side: "bottom", ordinal: 0},
                points: [
                    {x: 120, y: 280},
                    {x: 120, y: 250},
                    {x: 360, y: 250},
                    {x: 360, y: 188},
                ],
            },
            {
                id: "edge-7",
                sourceId: "Is Booking Tentative",
                targetId: "Confirm Booking",
                sourceAnchor: {x: 440, y: 160, side: "right", ordinal: 0},
                targetAnchor: {x: 500, y: 160, side: "left", ordinal: 0},
                points: [
                    {x: 440, y: 160},
                    {x: 460, y: 160},
                    {x: 460, y: 160},
                    {x: 500, y: 160},
                ],
            },
            {
                id: "edge-8",
                sourceId: "Confirm Booking",
                targetId: "Booking Confirmed",
                sourceAnchor: {x: 570, y: 188, side: "bottom", ordinal: 0},
                targetAnchor: {x: 570, y: 280, side: "top", ordinal: 0},
                points: [
                    {x: 570, y: 188},
                    {x: 570, y: 208},
                    {x: 570, y: 208},
                    {x: 570, y: 280},
                ],
            },
        ]);
    });

    it("lays out security settings graph", () => {
        const request: LayoutRequest = {
            nodes: [
                {id: "node-1", laneId: "lane-0", width: 180, height: 86},
                {id: "node-2", laneId: "lane-1", width: 180, height: 86},
                {id: "node-3", laneId: "lane-2", width: 180, height: 86},
                {id: "node-4", laneId: "lane-0", width: 180, height: 86},
                {id: "node-5", laneId: "lane-1", width: 180, height: 86},
                {id: "node-6", laneId: "lane-2", width: 180, height: 86},
                {id: "node-7", laneId: "lane-1", width: 180, height: 86},
            ],
            edges: [
                {id: "edge-node-1-node-2", sourceId: "node-1", targetId: "node-2"},
                {id: "edge-node-2-node-3", sourceId: "node-2", targetId: "node-3"},
                {id: "edge-node-4-node-5", sourceId: "node-4", targetId: "node-5"},
                {id: "edge-node-5-node-6", sourceId: "node-5", targetId: "node-6"},
                {id: "edge-node-6-node-7", sourceId: "node-6", targetId: "node-7"},
            ],
            lanes: [
                {id: "lane-0", order: 0},
                {id: "lane-1", order: 1},
                {id: "lane-2", order: 2},
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
            {id: "lane-0", top: -24, bottom: 110},
            {id: "lane-1", top: 154, bottom: 288},
            {id: "lane-2", top: 332, bottom: 466},
        ]);
        expect(result.result.nodes).toEqual([
            {id: "node-1", x: 0, y: 0, width: 180, height: 86},
            {id: "node-2", x: 20, y: 178, width: 180, height: 86},
            {id: "node-3", x: 40, y: 356, width: 180, height: 86},
            {id: "node-4", x: 210, y: 0, width: 180, height: 86},
            {id: "node-5", x: 230, y: 178, width: 180, height: 86},
            {id: "node-6", x: 250, y: 356, width: 180, height: 86},
            {id: "node-7", x: 440, y: 178, width: 180, height: 86},
        ]);
        expect(result.result.edges).toEqual([
            {
                id: "edge-node-1-node-2",
                sourceId: "node-1",
                targetId: "node-2",
                sourceAnchor: {x: 100, y: 86, side: "bottom", ordinal: 0},
                targetAnchor: {x: 100, y: 178, side: "top", ordinal: 0},
                points: [
                    {x: 100, y: 86},
                    {x: 100, y: 106},
                    {x: 100, y: 106},
                    {x: 100, y: 178},
                ],
            },
            {
                id: "edge-node-2-node-3",
                sourceId: "node-2",
                targetId: "node-3",
                sourceAnchor: {x: 120, y: 264, side: "bottom", ordinal: 0},
                targetAnchor: {x: 120, y: 356, side: "top", ordinal: 0},
                points: [
                    {x: 120, y: 264},
                    {x: 120, y: 284},
                    {x: 120, y: 284},
                    {x: 120, y: 356},
                ],
            },
            {
                id: "edge-node-4-node-5",
                sourceId: "node-4",
                targetId: "node-5",
                sourceAnchor: {x: 310, y: 86, side: "bottom", ordinal: 0},
                targetAnchor: {x: 310, y: 178, side: "top", ordinal: 0},
                points: [
                    {x: 310, y: 86},
                    {x: 310, y: 106},
                    {x: 310, y: 106},
                    {x: 310, y: 178},
                ],
            },
            {
                id: "edge-node-5-node-6",
                sourceId: "node-5",
                targetId: "node-6",
                sourceAnchor: {x: 330, y: 264, side: "bottom", ordinal: 0},
                targetAnchor: {x: 330, y: 356, side: "top", ordinal: 0},
                points: [
                    {x: 330, y: 264},
                    {x: 330, y: 284},
                    {x: 330, y: 284},
                    {x: 330, y: 356},
                ],
            },
            {
                id: "edge-node-6-node-7",
                sourceId: "node-6",
                targetId: "node-7",
                sourceAnchor: {x: 350, y: 356, side: "top", ordinal: 0},
                targetAnchor: {x: 520, y: 264, side: "bottom", ordinal: 0},
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
                {id: "node-1", laneId: "lane-1"},
                {id: "node-2", laneId: "lane-2"},
                {id: "node-3", laneId: "lane-1"},
                {id: "node-4", laneId: "lane-2"},
                {id: "node-5", laneId: "lane-1"},
            ],
            edges: [
                {id: "edge-1", sourceId: "node-1", targetId: "node-2"},
                {id: "edge-2", sourceId: "node-3", targetId: "node-4"},
                {id: "edge-3", sourceId: "node-4", targetId: "node-5"},
                {id: "edge-4", sourceId: "node-2", targetId: "node-5"},
            ],
            lanes: [
                {id: "lane-0", order: 0},
                {id: "lane-1", order: 1},
                {id: "lane-2", order: 2},
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
            {id: "lane-0", top: -24, bottom: 72},
            {id: "lane-1", top: 116, bottom: 212},
            {id: "lane-2", top: 256, bottom: 352},
        ]);
        expect(result.result.nodes).toEqual([
            {id: "node-1", x: 0, y: 140, width: 120, height: 48},
            {id: "node-2", x: 20, y: 280, width: 120, height: 48},
            {id: "node-3", x: 150, y: 140, width: 120, height: 48},
            {id: "node-4", x: 170, y: 280, width: 120, height: 48},
            {id: "node-5", x: 300, y: 140, width: 120, height: 48},
        ]);
        expect(result.result.edges).toEqual([
            {
                id: "edge-1",
                sourceId: "node-1",
                targetId: "node-2",
                sourceAnchor: {x: 70, y: 188, side: "bottom", ordinal: 0},
                targetAnchor: {x: 70, y: 280, side: "top", ordinal: 0},
                points: [
                    {x: 70, y: 188},
                    {x: 70, y: 208},
                    {x: 70, y: 208},
                    {x: 70, y: 280},
                ],
            },
            {
                id: "edge-2",
                sourceId: "node-3",
                targetId: "node-4",
                sourceAnchor: {x: 220, y: 188, side: "bottom", ordinal: 0},
                targetAnchor: {x: 220, y: 280, side: "top", ordinal: 0},
                points: [
                    {x: 220, y: 188},
                    {x: 220, y: 208},
                    {x: 220, y: 208},
                    {x: 220, y: 280},
                ],
            },
            {
                id: "edge-3",
                sourceId: "node-4",
                targetId: "node-5",
                sourceAnchor: {x: 240, y: 280, side: "top", ordinal: 0},
                targetAnchor: {x: 350, y: 188, side: "bottom", ordinal: 0},
                points: [
                    {x: 240, y: 280},
                    {x: 240, y: 260},
                    {x: 350, y: 260},
                    {x: 350, y: 188},
                ],
            },
            {
                id: "edge-4",
                sourceId: "node-2",
                targetId: "node-5",
                sourceAnchor: {x: 90, y: 280, side: "top", ordinal: 0},
                targetAnchor: {x: 340, y: 188, side: "bottom", ordinal: 0},
                points: [
                    {x: 90, y: 280},
                    {x: 90, y: 250},
                    {x: 340, y: 250},
                    {x: 340, y: 188},
                ],
            },
        ]);
    });

    it("lays out the disconnected security/sign-in/booking model after freezing compact ordering", () => {
        const request: LayoutRequest = {
            nodes: [
                {id: "node-1", laneId: "lane-0", width: 180, height: 86},
                {id: "node-2", laneId: "lane-1", width: 180, height: 86},
                {id: "node-3", laneId: "lane-2", width: 180, height: 86},
                {id: "node-4", laneId: "lane-0", width: 180, height: 86},
                {id: "node-5", laneId: "lane-1", width: 180, height: 86},
                {id: "node-6", laneId: "lane-2", width: 180, height: 86},
                {id: "node-7", laneId: "lane-1", width: 180, height: 86},
                {id: "node-8", laneId: "lane-0", width: 180, height: 86},
                {id: "node-9", laneId: "lane-1", width: 180, height: 86},
            ],
            edges: [
                {id: "edge-node-1-node-2", sourceId: "node-1", targetId: "node-2"},
                {id: "edge-node-2-node-3", sourceId: "node-2", targetId: "node-3"},
                {id: "edge-node-4-node-5", sourceId: "node-4", targetId: "node-5"},
                {id: "edge-node-5-node-6", sourceId: "node-5", targetId: "node-6"},
                {id: "edge-node-6-node-7", sourceId: "node-6", targetId: "node-7"},
                {id: "edge-node-8-node-9", sourceId: "node-8", targetId: "node-9"},
            ],
            lanes: [
                {id: "lane-0", order: 0},
                {id: "lane-1", order: 1},
                {id: "lane-2", order: 2},
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
            {id: "lane-0", top: -24, bottom: 110},
            {id: "lane-1", top: 154, bottom: 288},
            {id: "lane-2", top: 332, bottom: 466},
        ]);
        expect(result.result.nodes).toEqual([
            {id: "node-1", x: 0, y: 0, width: 180, height: 86},
            {id: "node-2", x: 20, y: 178, width: 180, height: 86},
            {id: "node-3", x: 40, y: 356, width: 180, height: 86},
            {id: "node-4", x: 210, y: 0, width: 180, height: 86},
            {id: "node-5", x: 230, y: 178, width: 180, height: 86},
            {id: "node-6", x: 250, y: 356, width: 180, height: 86},
            {id: "node-7", x: 650, y: 178, width: 180, height: 86},
            {id: "node-8", x: 420, y: 0, width: 180, height: 86},
            {id: "node-9", x: 440, y: 178, width: 180, height: 86},
        ]);
        expect(result.result.edges).toEqual([
            {
                id: "edge-node-1-node-2",
                sourceId: "node-1",
                targetId: "node-2",
                sourceAnchor: {x: 100, y: 86, side: "bottom", ordinal: 0},
                targetAnchor: {x: 100, y: 178, side: "top", ordinal: 0},
                points: [
                    {x: 100, y: 86},
                    {x: 100, y: 106},
                    {x: 100, y: 106},
                    {x: 100, y: 178},
                ],
            },
            {
                id: "edge-node-2-node-3",
                sourceId: "node-2",
                targetId: "node-3",
                sourceAnchor: {x: 120, y: 264, side: "bottom", ordinal: 0},
                targetAnchor: {x: 120, y: 356, side: "top", ordinal: 0},
                points: [
                    {x: 120, y: 264},
                    {x: 120, y: 284},
                    {x: 120, y: 284},
                    {x: 120, y: 356},
                ],
            },
            {
                id: "edge-node-4-node-5",
                sourceId: "node-4",
                targetId: "node-5",
                sourceAnchor: {x: 310, y: 86, side: "bottom", ordinal: 0},
                targetAnchor: {x: 310, y: 178, side: "top", ordinal: 0},
                points: [
                    {x: 310, y: 86},
                    {x: 310, y: 106},
                    {x: 310, y: 106},
                    {x: 310, y: 178},
                ],
            },
            {
                id: "edge-node-5-node-6",
                sourceId: "node-5",
                targetId: "node-6",
                sourceAnchor: {x: 330, y: 264, side: "bottom", ordinal: 0},
                targetAnchor: {x: 330, y: 356, side: "top", ordinal: 0},
                points: [
                    {x: 330, y: 264},
                    {x: 330, y: 284},
                    {x: 330, y: 284},
                    {x: 330, y: 356},
                ],
            },
            {
                id: "edge-node-6-node-7",
                sourceId: "node-6",
                targetId: "node-7",
                sourceAnchor: {x: 350, y: 356, side: "top", ordinal: 0},
                targetAnchor: {x: 730, y: 264, side: "bottom", ordinal: 0},
                points: [
                    {x: 350, y: 356},
                    {x: 350, y: 306},
                    {x: 730, y: 306},
                    {x: 730, y: 264},
                ],
            },
            {
                id: "edge-node-8-node-9",
                sourceId: "node-8",
                targetId: "node-9",
                sourceAnchor: {x: 520, y: 86, side: "bottom", ordinal: 0},
                targetAnchor: {x: 520, y: 178, side: "top", ordinal: 0},
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
                {id: "node-1", laneId: "lane-0"},
                {id: "node-2", laneId: "lane-1"},
                {id: "node-3", laneId: "lane-1"},
                {id: "node-4", laneId: "lane-2"},
                {id: "node-5", laneId: "lane-2"},
            ],
            edges: [
                {id: "edge-1", sourceId: "node-1", targetId: "node-2"},
                {id: "edge-2", sourceId: "node-2", targetId: "node-3"},
                {id: "edge-3", sourceId: "node-3", targetId: "node-4"},
                {id: "edge-4", sourceId: "node-4", targetId: "node-2", role: "back-reference"},
                {id: "edge-5", sourceId: "node-3", targetId: "node-5"},
                {id: "edge-6", sourceId: "node-5", targetId: "node-2", role: "back-reference"},
            ],
            lanes: [
                {id: "lane-0", order: 0},
                {id: "lane-1", order: 1},
                {id: "lane-2", order: 2},
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
            {id: "lane-0", top: -24, bottom: 72},
            {id: "lane-1", top: 116, bottom: 212},
            {id: "lane-2", top: 256, bottom: 352},
        ]);
        expect(result.result.nodes).toEqual([
            {id: "node-1", x: 0, y: 0, width: 120, height: 48},
            {id: "node-2", x: 20, y: 140, width: 120, height: 48},
            {id: "node-3", x: 200, y: 140, width: 120, height: 48},
            {id: "node-4", x: 220, y: 280, width: 120, height: 48},
            {id: "node-5", x: 370, y: 280, width: 120, height: 48},
        ]);
        expect(result.result.edges).toEqual([
            {
                id: "edge-1",
                sourceId: "node-1",
                targetId: "node-2",
                sourceAnchor: {x: 70, y: 48, side: "bottom", ordinal: 0},
                targetAnchor: {x: 70, y: 140, side: "top", ordinal: 0},
                points: [
                    {x: 70, y: 48},
                    {x: 70, y: 68},
                    {x: 70, y: 68},
                    {x: 70, y: 140},
                ],
            },
            {
                id: "edge-2",
                sourceId: "node-2",
                targetId: "node-3",
                sourceAnchor: {x: 140, y: 160, side: "right", ordinal: 0},
                targetAnchor: {x: 200, y: 160, side: "left", ordinal: 0},
                points: [
                    {x: 140, y: 160},
                    {x: 160, y: 160},
                    {x: 160, y: 160},
                    {x: 200, y: 160},
                ],
            },
            {
                id: "edge-3",
                sourceId: "node-3",
                targetId: "node-4",
                sourceAnchor: {x: 270, y: 188, side: "bottom", ordinal: 0},
                targetAnchor: {x: 270, y: 280, side: "top", ordinal: 0},
                points: [
                    {x: 270, y: 188},
                    {x: 270, y: 218},
                    {x: 270, y: 218},
                    {x: 270, y: 280},
                ],
            },
            {
                id: "edge-4",
                sourceId: "node-4",
                targetId: "node-2",
                sourceAnchor: {x: 260, y: 280, side: "top", ordinal: 0},
                targetAnchor: {x: 90, y: 188, side: "bottom", ordinal: 0},
                points: [
                    {x: 260, y: 280},
                    {x: 260, y: 260},
                    {x: 90, y: 260},
                    {x: 90, y: 188},
                ],
            },
            {
                id: "edge-5",
                sourceId: "node-3",
                targetId: "node-5",
                sourceAnchor: {x: 280, y: 188, side: "bottom", ordinal: 0},
                targetAnchor: {x: 420, y: 280, side: "top", ordinal: 0},
                points: [
                    {x: 280, y: 188},
                    {x: 280, y: 208},
                    {x: 420, y: 208},
                    {x: 420, y: 280},
                ],
            },
            {
                id: "edge-6",
                sourceId: "node-5",
                targetId: "node-2",
                sourceAnchor: {x: 410, y: 280, side: "top", ordinal: 0},
                targetAnchor: {x: 100, y: 188, side: "bottom", ordinal: 0},
                points: [
                    {x: 410, y: 280},
                    {x: 410, y: 250},
                    {x: 100, y: 250},
                    {x: 100, y: 188},
                ],
            },
        ]);
    });

    it("moves top-lane source nodes closer to their target horizontally", () => {
        const request: LayoutRequest = {
            nodes: [
                {id: "node-1", laneId: "lane-0"},
                {id: "node-2", laneId: "lane-1"},
                {id: "node-3", laneId: "lane-2"},
                {id: "node-4", laneId: "lane-1"},
                {id: "node-5", laneId: "lane-0"},
                {id: "node-6", laneId: "lane-1"},
            ],
            edges: [
                {id: "edge-1", sourceId: "node-1", targetId: "node-2"},
                {id: "edge-2", sourceId: "node-2", targetId: "node-3"},
                {id: "edge-3", sourceId: "node-3", targetId: "node-4"},
                {id: "edge-4", sourceId: "node-5", targetId: "node-6"},
                {id: "edge-5", sourceId: "node-4", targetId: "node-6"},
            ],
            lanes: [
                {id: "lane-0", order: 0},
                {id: "lane-1", order: 1},
                {id: "lane-2", order: 2},
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
            {id: "lane-0", top: -24, bottom: 72},
            {id: "lane-1", top: 116, bottom: 212},
            {id: "lane-2", top: 256, bottom: 352},
        ]);
        expect(result.result.nodes).toEqual([
            {id: "node-1", x: 0, y: 0, width: 120, height: 48},
            {id: "node-2", x: 20, y: 140, width: 120, height: 48},
            {id: "node-3", x: 40, y: 280, width: 120, height: 48},
            {id: "node-4", x: 170, y: 140, width: 120, height: 48},
            {id: "node-5", x: 330, y: 0, width: 120, height: 48},
            {id: "node-6", x: 350, y: 140, width: 120, height: 48},
        ]);
        expect(result.result.edges).toEqual([
            {
                id: "edge-1",
                sourceId: "node-1",
                targetId: "node-2",
                sourceAnchor: {x: 70, y: 48, side: "bottom", ordinal: 0},
                targetAnchor: {x: 70, y: 140, side: "top", ordinal: 0},
                points: [
                    {x: 70, y: 48},
                    {x: 70, y: 68},
                    {x: 70, y: 68},
                    {x: 70, y: 140},
                ],
            },
            {
                id: "edge-2",
                sourceId: "node-2",
                targetId: "node-3",
                sourceAnchor: {x: 90, y: 188, side: "bottom", ordinal: 0},
                targetAnchor: {x: 90, y: 280, side: "top", ordinal: 0},
                points: [
                    {x: 90, y: 188},
                    {x: 90, y: 208},
                    {x: 90, y: 208},
                    {x: 90, y: 280},
                ],
            },
            {
                id: "edge-3",
                sourceId: "node-3",
                targetId: "node-4",
                sourceAnchor: {x: 110, y: 280, side: "top", ordinal: 0},
                targetAnchor: {x: 220, y: 188, side: "bottom", ordinal: 0},
                points: [
                    {x: 110, y: 280},
                    {x: 110, y: 260},
                    {x: 220, y: 260},
                    {x: 220, y: 188},
                ],
            },
            {
                id: "edge-4",
                sourceId: "node-5",
                targetId: "node-6",
                sourceAnchor: {x: 400, y: 48, side: "bottom", ordinal: 0},
                targetAnchor: {x: 400, y: 140, side: "top", ordinal: 0},
                points: [
                    {x: 400, y: 48},
                    {x: 400, y: 68},
                    {x: 400, y: 68},
                    {x: 400, y: 140},
                ],
            },
            {
                id: "edge-5",
                sourceId: "node-4",
                targetId: "node-6",
                sourceAnchor: {x: 290, y: 160, side: "right", ordinal: 0},
                targetAnchor: {x: 350, y: 160, side: "left", ordinal: 0},
                points: [
                    {x: 290, y: 160},
                    {x: 310, y: 160},
                    {x: 310, y: 160},
                    {x: 350, y: 160},
                ],
            },
        ]);
    });
});