import { describe, expect, it, vi } from "vitest";

import {
  createChimeWav,
  DEFAULT_FAILURE_CHIME,
  DEFAULT_SUCCESS_CHIME,
  vitestChimeReporter,
} from "./chimeReporter";

describe("createChimeWav", () => {
  it("returns a RIFF/WAVE payload", () => {
    const wav = createChimeWav(DEFAULT_SUCCESS_CHIME);

    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(wav.byteLength).toBeGreaterThan(44);
  });
});

describe("vitestChimeReporter", () => {
  it("plays a happy chime when the run passes", async () => {
    const player = vi.fn<(_: Uint8Array, kind: "happy" | "sad") => Promise<void>>().mockResolvedValue();
    const reporter = vitestChimeReporter({ player });

    reporter.onInit?.({
      state: {
        getCountOfFailedTests: () => 0,
      },
    } as never);

    await reporter.onTestRunEnd?.([], [], "passed");

    expect(player).toHaveBeenCalledTimes(1);
    expect(player.mock.calls[0]?.[1]).toBe("happy");
  });

  it("plays a sad chime when the run fails", async () => {
    const player = vi.fn<(_: Uint8Array, kind: "happy" | "sad") => Promise<void>>().mockResolvedValue();
    const reporter = vitestChimeReporter({ player });

    reporter.onInit?.({
      state: {
        getCountOfFailedTests: () => 1,
      },
    } as never);

    await reporter.onTestRunEnd?.([], [], "failed");

    expect(player).toHaveBeenCalledTimes(1);
    expect(player.mock.calls[0]?.[1]).toBe("sad");
  });

  it("does not play a chime for interrupted runs", async () => {
    const player = vi.fn<(_: Uint8Array, kind: "happy" | "sad") => Promise<void>>().mockResolvedValue();
    const reporter = vitestChimeReporter({ player });

    reporter.onInit?.({
      state: {
        getCountOfFailedTests: () => 0,
      },
    } as never);

    await reporter.onTestRunEnd?.([], [], "interrupted");

    expect(player).not.toHaveBeenCalled();
  });

  it("uses the failure chime when unhandled errors are reported", async () => {
    const player = vi.fn<(_: Uint8Array, kind: "happy" | "sad") => Promise<void>>().mockResolvedValue();
    const reporter = vitestChimeReporter({
      failureChime: DEFAULT_FAILURE_CHIME,
      player,
    });

    reporter.onInit?.({
      state: {
        getCountOfFailedTests: () => 0,
      },
    } as never);

    await reporter.onTestRunEnd?.([], [{} as never], "passed");

    expect(player).toHaveBeenCalledTimes(1);
    expect(player.mock.calls[0]?.[1]).toBe("sad");
  });
});
