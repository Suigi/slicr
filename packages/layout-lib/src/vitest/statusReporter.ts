import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { TestCase } from "vitest/node";
import type { Reporter } from "vitest/reporters";

export const DEFAULT_STATUS_FILE = ".vitest-test-status.json";

export type VitestStatusReporterOptions = {
  outputFile?: string;
  rootDir?: string;
  write?: (outputFile: string, snapshot: VitestStatusSnapshot) => Promise<void>;
};

export type VitestStatusSnapshot = {
  generatedAt: string;
  tests: VitestTestStatusEntry[];
};

export type VitestTestStatusEntry = {
  id: string;
  file: string;
  suite: string;
  title: string;
  status: "pass" | "fail" | "skip" | "todo";
  durationMs: number | null;
};

export function vitestStatusReporter(
  options: VitestStatusReporterOptions = {},
): Reporter {
  const entries = new Map<string, VitestTestStatusEntry>();
  const writer = options.write ?? writeStatusSnapshot;

  return {
    onTestCaseResult(testCase) {
      const entry = createStatusEntry(testCase);
      if (!entry) {
        return;
      }
      entries.set(entry.id, entry);
    },
    async onTestRunEnd() {
      const snapshot: VitestStatusSnapshot = {
        generatedAt: new Date().toISOString(),
        tests: [...entries.values()].sort(compareStatusEntries),
      };

      const outputFile = resolve(options.rootDir ?? process.cwd(), options.outputFile ?? DEFAULT_STATUS_FILE);
      await writer(outputFile, snapshot);
    },
  };
}

export function createStatusEntry(
  testCase: Pick<TestCase, "name" | "module" | "parent" | "result" | "diagnostic">,
): VitestTestStatusEntry | null {
  const title = testCase.name;
  const file = testCase.module?.relativeModuleId;
  if (!file || !title) {
    return null;
  }

  const suite = testCase.parent?.type === "suite" ? testCase.parent.name : "";
  const status = normalizeTestState(testCase.result().state);
  return {
    id: `${file}::${suite}::${title}`,
    file,
    suite,
    title,
    status,
    durationMs: testCase.diagnostic()?.duration ?? null,
  };
}

export async function writeStatusSnapshot(outputFile: string, snapshot: VitestStatusSnapshot) {
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

function normalizeTestState(state: string | undefined): VitestTestStatusEntry["status"] {
  if (state === "fail" || state === "failed") {
    return "fail";
  }
  if (state === "skip" || state === "skipped") {
    return "skip";
  }
  if (state === "todo") {
    return "todo";
  }
  return "pass";
}

function compareStatusEntries(left: VitestTestStatusEntry, right: VitestTestStatusEntry) {
  return `${left.file}\u0000${left.suite}\u0000${left.title}`.localeCompare(
    `${right.file}\u0000${right.suite}\u0000${right.title}`,
  );
}
