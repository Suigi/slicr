import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createTestStatusStore, parseImportableCases } from "./vite.config";

describe("createTestStatusStore", () => {
  it("broadcasts unknown immediately for locally edited tests and restores file-backed status after reload", async () => {
    const messages: Array<{ statuses: Array<{ id: string; status: string }> }> = [];
    const loadStatuses = vi
      .fn<(_: string) => Promise<Map<string, "pass" | "fail" | "skip" | "todo" | "unknown">>>()
      .mockResolvedValueOnce(new Map([["case-1", "fail"]]))
      .mockResolvedValueOnce(new Map([["case-1", "pass"]]));
    const watcher = {
      close: vi.fn(),
      on: vi.fn().mockReturnThis(),
    };
    const store = createTestStatusStore({
      loadStatuses,
      watchRoot: vi.fn().mockReturnValue(watcher),
      writeUpdate: (_res, message) => {
        messages.push(message);
      },
    });

    await store.start("/repo");

    const client = {
      writeHead: vi.fn(),
      write: vi.fn(),
      on: vi.fn(),
      end: vi.fn(),
    };
    store.addClient(client as never);
    expect(store.getStatus("case-1")).toBe("fail");
    expect(messages.at(-1)).toEqual({
      statuses: [{ id: "case-1", status: "fail" }],
    });

    store.markDirty("case-1");
    expect(store.getStatus("case-1")).toBe("unknown");
    expect(messages.at(-1)).toEqual({
      statuses: [{ id: "case-1", status: "unknown" }],
    });

    await store.reloadForTests();
    expect(store.getStatus("case-1")).toBe("pass");
    expect(messages.at(-1)).toEqual({
      statuses: [{ id: "case-1", status: "pass" }],
    });
  });
});

describe("parseImportableCases", () => {
  it("extracts asserted node and edge geometry from generated vitest cases", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "layout-lib-import-"));
    const filePath = path.join(root, "src", "example.test.ts");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      `import { expect, it } from "vitest";
import type { LayoutRequest } from "./types";

it("imports asserted geometry", () => {
  const request: LayoutRequest = {
    nodes: [{ id: "node-1", laneId: "lane-0" }, { id: "node-2", laneId: "lane-1" }],
    edges: [{ id: "edge-1", sourceId: "node-1", targetId: "node-2" }],
    lanes: [{ id: "lane-0", order: 0 }, { id: "lane-1", order: 1 }],
    defaults: { nodeWidth: 120, nodeHeight: 48 },
  };

  const result = layout(request);

  expect(result.result.nodes).toEqual([
    { id: "node-1", x: 10, y: 20, width: 120, height: 48 },
    { id: "node-2", x: 200, y: 160, width: 120, height: 48 },
  ]);
  expect(result.result.edges).toEqual([
    {
      id: "edge-1",
      sourceId: "node-1",
      targetId: "node-2",
      sourceAnchor: { x: 70, y: 68, side: "bottom", ordinal: 0 },
      targetAnchor: { x: 260, y: 160, side: "top", ordinal: 0 },
      points: [
        { x: 70, y: 68 },
        { x: 70, y: 88 },
        { x: 260, y: 88 },
        { x: 260, y: 160 },
      ],
    },
  ]);
});
`,
      "utf8",
    );

    const [parsedCase] = await parseImportableCases(root, filePath);

    expect(parsedCase.assertedGeometry).toEqual({
      nodes: [
        { id: "node-1", x: 10, y: 20, width: 120, height: 48 },
        { id: "node-2", x: 200, y: 160, width: 120, height: 48 },
      ],
      edges: [
        {
          id: "edge-1",
          sourceId: "node-1",
          targetId: "node-2",
          sourceAnchor: { x: 70, y: 68, side: "bottom", ordinal: 0 },
          targetAnchor: { x: 260, y: 160, side: "top", ordinal: 0 },
          points: [
            { x: 70, y: 68 },
            { x: 70, y: 88 },
            { x: 260, y: 88 },
            { x: 260, y: 160 },
          ],
        },
      ],
    });
  });
});
