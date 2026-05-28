import { randomUUID } from "node:crypto";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { Vitest } from "vitest/node";
import type { Reporter } from "vitest/reporters";

export type ChimeNote = {
  frequencyHz: number;
  durationMs: number;
};

export type VitestChimeReporterOptions = {
  enabled?: boolean;
  fallbackToBell?: boolean;
  successChime?: readonly ChimeNote[];
  failureChime?: readonly ChimeNote[];
  player?: (wavFile: Uint8Array, kind: "happy" | "sad") => Promise<void>;
};

export const DEFAULT_SUCCESS_CHIME: readonly ChimeNote[] = [
  { frequencyHz: 523.25, durationMs: 60 },
  { frequencyHz: 659.25, durationMs: 60 },
  { frequencyHz: 783.99, durationMs: 110 },
];

export const DEFAULT_FAILURE_CHIME: readonly ChimeNote[] = [
  { frequencyHz: 392, durationMs: 80 },
  { frequencyHz: 329.63, durationMs: 80 },
  { frequencyHz: 261.63, durationMs: 150 },
];

const SAMPLE_RATE = 44_100;
const CHANNEL_COUNT = 1;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const GAP_MS = 30;
const ATTACK_MS = 8;
const RELEASE_MS = 18;
const AMPLITUDE = 0.22;

type ChimeKind = "happy" | "sad";

export function vitestChimeReporter(
  options: VitestChimeReporterOptions = {},
): Reporter {
  let vitest: Vitest | undefined;

  return {
    onInit(context) {
      vitest = context;
    },
    async onTestRunEnd(_testModules, unhandledErrors, reason) {
      if (options.enabled === false) {
        return;
      }

      const failedTests = vitest?.state.getCountOfFailedTests() ?? 0;
      const hasUnhandledErrors = unhandledErrors.length > 0;

      let kind: ChimeKind | null = null;
      if (reason === "passed" && failedTests === 0 && !hasUnhandledErrors) {
        kind = "happy";
      }
      else if (reason === "failed" || failedTests > 0 || hasUnhandledErrors) {
        kind = "sad";
      }

      if (!kind) {
        return;
      }

      const notes = kind === "happy"
        ? (options.successChime ?? DEFAULT_SUCCESS_CHIME)
        : (options.failureChime ?? DEFAULT_FAILURE_CHIME);

      const player = options.player ?? createDefaultPlayer({
        fallbackToBell: options.fallbackToBell ?? true,
      });

      await player(createChimeWav(notes), kind);
    },
  };
}

export function createChimeWav(notes: readonly ChimeNote[]): Uint8Array {
  const samples = buildSamples(notes);
  const dataSize = samples.length * BYTES_PER_SAMPLE;
  const wav = new Uint8Array(44 + dataSize);
  const view = new DataView(wav.buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNEL_COUNT, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNEL_COUNT * BYTES_PER_SAMPLE, true);
  view.setUint16(32, CHANNEL_COUNT * BYTES_PER_SAMPLE, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  samples.forEach((sample, index) => {
    view.setInt16(44 + (index * BYTES_PER_SAMPLE), sample, true);
  });

  return wav;
}

function buildSamples(notes: readonly ChimeNote[]): Int16Array {
  const gapSamples = msToSamples(GAP_MS);
  const noteSampleCount = notes.reduce(
    (count, note, index) => count + msToSamples(note.durationMs) + (index < notes.length - 1 ? gapSamples : 0),
    0,
  );

  const samples = new Int16Array(noteSampleCount);
  let cursor = 0;

  for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
    const note = notes[noteIndex];
    const sampleCount = msToSamples(note.durationMs);
    const attackSamples = Math.min(msToSamples(ATTACK_MS), sampleCount);
    const releaseSamples = Math.min(msToSamples(RELEASE_MS), sampleCount);

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const t = sampleIndex / SAMPLE_RATE;
      const raw = Math.sin(2 * Math.PI * note.frequencyHz * t);
      const envelope = amplitudeEnvelope(sampleIndex, sampleCount, attackSamples, releaseSamples);
      samples[cursor] = Math.round(raw * envelope * AMPLITUDE * 0x7fff);
      cursor += 1;
    }

    if (noteIndex < notes.length - 1) {
      cursor += gapSamples;
    }
  }

  return samples;
}

function amplitudeEnvelope(
  sampleIndex: number,
  sampleCount: number,
  attackSamples: number,
  releaseSamples: number,
): number {
  if (attackSamples > 0 && sampleIndex < attackSamples) {
    return sampleIndex / attackSamples;
  }

  const releaseStart = sampleCount - releaseSamples;
  if (releaseSamples > 0 && sampleIndex >= releaseStart) {
    return Math.max(0, (sampleCount - sampleIndex) / releaseSamples);
  }

  return 1;
}

function msToSamples(durationMs: number): number {
  return Math.max(1, Math.round((durationMs / 1000) * SAMPLE_RATE));
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function createDefaultPlayer(options: { fallbackToBell: boolean }) {
  return async (wavFile: Uint8Array): Promise<void> => {
    const wavPath = join(tmpdir(), `vitest-chime-${randomUUID()}.wav`);
    await writeFile(wavPath, wavFile);

    try {
      const played = await playAudioFile(wavPath);
      if (!played && options.fallbackToBell) {
        process.stdout.write("\u0007");
      }
    }
    finally {
      await rm(wavPath, { force: true });
    }
  };
}

async function playAudioFile(wavPath: string): Promise<boolean> {
  for (const candidate of getAudioPlayers(wavPath)) {
    const played = await trySpawn(candidate.command, candidate.args);
    if (played) {
      return true;
    }
  }

  return false;
}

function getAudioPlayers(wavPath: string): Array<{ command: string; args: string[] }> {
  switch (process.platform) {
    case "darwin":
      return [{ command: "afplay", args: [wavPath] }];
    case "win32":
      return [{
        command: "powershell",
        args: [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(New-Object Media.SoundPlayer '${wavPath.replaceAll("'", "''")}').PlaySync()`,
        ],
      }];
    default:
      return [
        { command: "paplay", args: [wavPath] },
        { command: "aplay", args: ["-q", wavPath] },
        { command: "play", args: ["-q", wavPath] },
      ];
  }
}

function trySpawn(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}
