import {describe, expect, it} from "vitest";
import {routeEdges} from "./routeEdges";
import type {RouteEdgesRequest} from "./types";

describe("routeEdges", () => {
    it("routes a single-column edge as a centered straight line from the top node bottom to the bottom node top", () => {
        const request: RouteEdgesRequest = {
            nodes: [
                {id: "top", laneId: "lane-0", x: 100, y: 50, width: 120, height: 60},
                {id: "bottom", laneId: "lane-1", x: 100, y: 180, width: 120, height: 60},
            ],
            edges: [{id: "edge-1", sourceId: "top", targetId: "bottom"}],
        };

        const result = routeEdges(request);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.result.edges).toEqual([
            {
                id: "edge-1",
                sourceId: "top",
                targetId: "bottom",
                sourceAnchor: {x: 160, y: 110, side: "bottom", ordinal: 0},
                targetAnchor: {x: 160, y: 180, side: "top", ordinal: 0},
                points: [
                    {x: 160, y: 110},
                    {x: 160, y: 180},
                ],
            },
        ]);
    });

    it("routes an edge to a horizontally offset target with bends after leaving the source and before entering the target", () => {
        const request: RouteEdgesRequest = {
            nodes: [
                {id: "top", laneId: "lane-0", x: 100, y: 50, width: 120, height: 60},
                {id: "bottom", laneId: "lane-1", x: 140, y: 180, width: 120, height: 60},
            ],
            edges: [{id: "edge-1", sourceId: "top", targetId: "bottom"}],
        };

        const result = routeEdges(request);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.result.edges).toEqual([
            {
                id: "edge-1",
                sourceId: "top",
                targetId: "bottom",
                sourceAnchor: {x: 160, y: 110, side: "bottom", ordinal: 0},
                targetAnchor: {x: 200, y: 180, side: "top", ordinal: 0},
                points: [
                    {x: 160, y: 110},
                    {x: 160, y: 130},
                    {x: 200, y: 130},
                    {x: 200, y: 180},
                ],
            },
        ]);
    });

    it("routes an upward edge from a lower-left source out the top side and into the target left side", () => {
        const request: RouteEdgesRequest = {
            nodes: [
                {id: "A", laneId: "lane-1", x: 100, y: 200, width: 120, height: 60},
                {id: "B", laneId: "lane-0", x: 240, y: 50, width: 120, height: 60},
            ],
            edges: [{id: "edge-1", sourceId: "A", targetId: "B"}],
        };

        const result = routeEdges(request);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.result.edges[0]).toMatchObject({
            id: "edge-1",
            sourceId: "A",
            targetId: "B",
            sourceAnchor: {x: 160, y: 200, side: "top", ordinal: 0},
            targetAnchor: {x: 240, y: 80, side: "left", ordinal: 0},
            points: [
                {x: 160, y: 200},
                {x: 160, y: 80},
                {x: 240, y: 80},
            ],
        });
    });
});
