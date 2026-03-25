import { describe, expect, it, vi } from "vitest";

import {
  createStatusEntry,
  DEFAULT_STATUS_FILE,
  vitestStatusReporter,
} from "./statusReporter";

describe("createStatusEntry", () => {
  it("builds a stable id from file, suite, and test title", () => {
    const entry = createStatusEntry(
      {
        name: "lays out 3 nodes across lane-0, lane-1",
        module: { relativeModuleId: "src/layout/layout.acceptance.test.ts" },
        parent: { type: "suite", name: "layout acceptance: minimal A -> B -> C" },
        result: () => ({ state: "passed" }),
        diagnostic: () => ({ duration: 17 }),
      } as never,
    );

    expect(entry).toEqual({
      id: "src/layout/layout.acceptance.test.ts::layout acceptance: minimal A -> B -> C::lays out 3 nodes across lane-0, lane-1",
      file: "src/layout/layout.acceptance.test.ts",
      suite: "layout acceptance: minimal A -> B -> C",
      title: "lays out 3 nodes across lane-0, lane-1",
      status: "pass",
      durationMs: 17,
    });
  });

  it("normalizes failed and skipped states", () => {
    expect(
      createStatusEntry(
        {
          name: "failed test",
          module: { relativeModuleId: "src/example.test.ts" },
          parent: { type: "suite", name: "suite" },
          result: () => ({ state: "failed" }),
          diagnostic: () => undefined,
        } as never,
      )?.status,
    ).toBe("fail");
    expect(
      createStatusEntry(
        {
          name: "skipped test",
          module: { relativeModuleId: "src/example.test.ts" },
          parent: { type: "suite", name: "suite" },
          result: () => ({ state: "skipped" }),
          diagnostic: () => undefined,
        } as never,
      )?.status,
    ).toBe("skip");
    expect(
      createStatusEntry(
        {
          name: "todo test",
          module: { relativeModuleId: "src/example.test.ts" },
          parent: { type: "suite", name: "suite" },
          result: () => ({ state: "skipped" }),
          diagnostic: () => undefined,
        } as never,
      )?.status,
    ).toBe("skip");
  });

  it("returns null when the file path or title is missing", () => {
    expect(
      createStatusEntry({
        name: "",
        module: { relativeModuleId: "src/example.test.ts" },
        parent: { type: "suite", name: "suite" },
        result: () => ({ state: "passed" }),
        diagnostic: () => undefined,
      } as never),
    ).toBeNull();

    expect(
      createStatusEntry({
        name: "test title",
        module: { relativeModuleId: "" },
        parent: { type: "suite", name: "suite" },
        result: () => ({ state: "passed" }),
        diagnostic: () => undefined,
      } as never),
    ).toBeNull();
  });
});

describe("vitestStatusReporter", () => {
  it("writes a sorted snapshot at the end of the run", async () => {
    const write = vi.fn<(_: string, snapshot: unknown) => Promise<void>>().mockResolvedValue();
    const reporter = vitestStatusReporter({ rootDir: "/repo", write });

    reporter.onTestCaseResult?.({
      name: "second test",
      module: { relativeModuleId: "src/b.test.ts" },
      parent: { type: "suite", name: "suite-b" },
      result: () => ({ state: "failed" }),
      diagnostic: () => ({ duration: 22 }),
    } as never);
    reporter.onTestCaseResult?.({
      name: "first test",
      module: { relativeModuleId: "src/a.test.ts" },
      parent: { type: "suite", name: "suite-a" },
      result: () => ({ state: "passed" }),
      diagnostic: () => ({ duration: 11 }),
    } as never);

    await reporter.onTestRunEnd?.([], [], "passed");

    expect(write).toHaveBeenCalledWith("/repo/.vitest-test-status.json", {
      generatedAt: expect.any(String),
      tests: [
        {
          id: "src/a.test.ts::suite-a::first test",
          file: "src/a.test.ts",
          suite: "suite-a",
          title: "first test",
          status: "pass",
          durationMs: 11,
        },
        {
          id: "src/b.test.ts::suite-b::second test",
          file: "src/b.test.ts",
          suite: "suite-b",
          title: "second test",
          status: "fail",
          durationMs: 22,
        },
      ],
    });
  });

  it("uses the default output file when none is provided", () => {
    expect(DEFAULT_STATUS_FILE).toBe(".vitest-test-status.json");
  });
});
