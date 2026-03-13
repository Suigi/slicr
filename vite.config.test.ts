import { describe, expect, it, vi } from "vitest";

import { createTestStatusStore } from "./vite.config";

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
