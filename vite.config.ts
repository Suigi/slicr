import type { IncomingMessage, ServerResponse } from "node:http";
import { watch, type FSWatcher } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { defineConfig, type Plugin } from "vite";
import { DEFAULT_STATUS_FILE, type VitestStatusSnapshot } from "./src/vitest/statusReporter";

type ImportedTestCase = {
  id: string;
  file: string;
  describe: string;
  title: string;
  status: "pass" | "fail" | "skip" | "todo" | "unknown";
  request: unknown;
  assertedGeometry: ImportedAssertedGeometry | null;
  start: number;
  end: number;
};

type ImportedTestCaseStatus = ImportedTestCase["status"];
type ImportedAssertedGeometry = {
  nodes: unknown[];
  edges: unknown[];
};
type StatusUpdateMessage = {
  statuses: Array<{ id: string; status: ImportedTestCaseStatus }>;
};

type TestStatusStoreOptions = {
  loadStatuses?: (root: string) => Promise<Map<string, ImportedTestCaseStatus>>;
  watchRoot?: (root: string, onChange: () => void) => FSWatcher;
  writeUpdate?: (res: ServerResponse, message: StatusUpdateMessage) => void;
};

function testImportPlugin(): Plugin {
  const statusStore = createTestStatusStore();

  return {
    name: "test-import-browser",
    apply: "serve",
    configureServer(server) {
      const root = server.config.root;
      void statusStore.start(root);
      server.httpServer?.once("close", () => statusStore.stop());

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url === "/__test-import/status-stream") {
          if (req.method !== "GET") {
            sendJson(res, { error: "Method not allowed." }, 405);
            return;
          }
          await statusStore.ready();
          statusStore.addClient(res);
          return;
        }

        if (!url?.startsWith("/__test-import/cases")) {
          next();
          return;
        }

        try {
          await statusStore.ready();
          const cases = await collectImportableTestCases(root, statusStore);
          if (url === "/__test-import/cases") {
            sendJson(
              res,
              cases.map(({ id, file, describe, title, status }) => ({ id, file, describe, title, status })),
            );
            return;
          }

          const encodedId = url.slice("/__test-import/cases/".length);
          const caseId = decodeURIComponent(encodedId);
          const match = cases.find((entry) => entry.id === caseId);
          if (!match) {
            sendJson(res, { error: "Test case not found." }, 404);
            return;
          }

          if (req.method === "POST") {
            const body = await readJsonBody(req);
            if (!body || typeof body !== "object" || !("content" in body) || typeof body.content !== "string") {
              sendJson(res, { error: "Request body must include string content." }, 400);
              return;
            }
            await overwriteTestCase(server.config.root, match, body.content);
            statusStore.markDirty(match.id);
            sendJson(res, { ok: true });
            return;
          }

          sendJson(res, match);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to read test cases.";
          sendJson(res, { error: message }, 500);
        }
      });
    },
  };
}

async function collectImportableTestCases(root: string, statusStore: ReturnType<typeof createTestStatusStore>) {
  const srcDir = path.join(root, "src");
  const files = await findTestFiles(srcDir);
  const cases = await Promise.all(files.map(async (filePath) => parseImportableCases(root, filePath)));
  return cases.flat().map((testCase) => ({
    ...testCase,
    status: statusStore.getStatus(testCase.id),
  }));
}

async function findTestFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const nextPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findTestFiles(nextPath);
      }
      if (entry.isFile() && entry.name.endsWith(".test.ts")) {
        return [nextPath];
      }
      return [];
    }),
  );
  return files.flat();
}

export async function parseImportableCases(root: string, filePath: string): Promise<ImportedTestCase[]> {
  const fileContents = await readFile(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, fileContents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const cases: ImportedTestCase[] = [];
  const describeStack: string[] = [];
  const relativeFile = path.relative(root, filePath);

  visit(sourceFile);
  return cases;

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = getCallName(node.expression);
      if ((callee === "describe" || callee === "it") && node.arguments.length >= 2) {
        const title = readStringLiteral(node.arguments[0]);
        const callback = node.arguments[1];
        if (title && callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          if (callee === "describe") {
            describeStack.push(title);
            visit(callback.body);
            describeStack.pop();
            return;
          }
          const requestObject = readInlineRequest(callback.body, sourceFile);
          if (requestObject) {
            const assertedGeometry = readAssertedGeometry(callback.body, sourceFile);
            const describeTitle = describeStack.at(-1) ?? relativeFile;
            const id = `${relativeFile}::${describeTitle}::${title}`;
            cases.push({
              id,
              file: relativeFile,
              describe: describeTitle,
              title,
              status: "unknown",
              request: requestObject,
              assertedGeometry,
              start: node.getStart(sourceFile),
              end: node.getEnd(),
            });
          }
          return;
        }
      }
    }

    ts.forEachChild(node, visit);
  }
}

function readInlineRequest(body: ts.ConciseBody, sourceFile: ts.SourceFile) {
  if (!ts.isBlock(body)) {
    return null;
  }

  for (const statement of body.statements) {
    if (!ts.isVariableStatement(statement) || !hasConstModifier(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "request") {
        continue;
      }
      if (!declaration.type || declaration.type.getText(sourceFile) !== "LayoutRequest") {
        continue;
      }
      if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
        continue;
      }
      return evaluateObjectLiteral(declaration.initializer.getText(sourceFile));
    }
  }

  return null;
}

function readAssertedGeometry(body: ts.ConciseBody, sourceFile: ts.SourceFile): ImportedAssertedGeometry | null {
  if (!ts.isBlock(body)) {
    return null;
  }

  let nodes: unknown[] | null = null;
  let edges: unknown[] | null = null;

  for (const statement of body.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
      continue;
    }
    const assertion = readToEqualAssertion(statement.expression, sourceFile);
    if (!assertion || !Array.isArray(assertion.value)) {
      continue;
    }
    if (assertion.subject === "result.result.nodes") {
      nodes = assertion.value;
      continue;
    }
    if (assertion.subject === "result.result.edges") {
      edges = assertion.value;
    }
  }

  if (!nodes && !edges) {
    return null;
  }
  return {
    nodes: nodes ?? [],
    edges: edges ?? [],
  };
}

function readToEqualAssertion(expression: ts.CallExpression, sourceFile: ts.SourceFile) {
  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== "toEqual" ||
    expression.arguments.length !== 1
  ) {
    return null;
  }

  const matcherCall = expression.expression.expression;
  if (
    !ts.isCallExpression(matcherCall) ||
    !ts.isIdentifier(matcherCall.expression) ||
    matcherCall.expression.text !== "expect" ||
    matcherCall.arguments.length !== 1
  ) {
    return null;
  }

  const subject = matcherCall.arguments[0].getText(sourceFile);
  return {
    subject,
    value: evaluateObjectLiteral(expression.arguments[0].getText(sourceFile)),
  };
}

async function loadLastRunStatus(root: string) {
  const statusFile = path.join(root, DEFAULT_STATUS_FILE);
  try {
    const raw = await readFile(statusFile, "utf8");
    const snapshot = JSON.parse(raw) as VitestStatusSnapshot;
    return new Map(snapshot.tests.map((entry) => [entry.id, entry.status]));
  } catch {
    return new Map<string, ImportedTestCase["status"]>();
  }
}

function evaluateObjectLiteral(value: string) {
  const parsed = Function(`"use strict"; return (${value});`)() as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Parsed request is not an object literal.");
  }
  return parsed;
}

function hasConstModifier(statement: ts.VariableStatement) {
  return (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
}

function readStringLiteral(node: ts.Expression) {
  return ts.isStringLiteralLike(node) ? node.text : null;
}

function getCallName(expression: ts.LeftHandSideExpression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  return null;
}

async function overwriteTestCase(root: string, testCase: ImportedTestCase, nextContent: string) {
  const absoluteFile = path.join(root, testCase.file);
  const fileContents = await readFile(absoluteFile, "utf8");
  const updatedContents = `${fileContents.slice(0, testCase.start)}${nextContent}${fileContents.slice(testCase.end)}`;
  await writeFile(absoluteFile, updatedContents, "utf8");
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return null;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function sendJson(res: ServerResponse, body: unknown, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function createTestStatusStore(options: TestStatusStoreOptions = {}) {
  const clients = new Set<ServerResponse>();
  const fileStatuses = new Map<string, ImportedTestCaseStatus>();
  const inMemoryOverrides = new Map<string, ImportedTestCaseStatus>();
  const loadStatuses = options.loadStatuses ?? loadLastRunStatus;
  const writeUpdate = options.writeUpdate ?? writeStatusUpdate;
  let rootDir: string | null = null;
  let watcher: FSWatcher | null = null;
  let reloadPromise: Promise<void> | null = null;
  let readyPromise: Promise<void> = Promise.resolve();

  return {
    async start(root: string) {
      if (rootDir === root) {
        return;
      }
      this.stop();
      rootDir = root;
      readyPromise = reloadStatuses();
      await readyPromise;
      watcher = (options.watchRoot ?? watchStatusRoot)(root, () => {
        void reloadStatuses();
      });
      watcher.on("error", () => {
        void reloadStatuses();
      });
    },
    stop() {
      watcher?.close();
      watcher = null;
      for (const client of clients) {
        client.end();
      }
      clients.clear();
      fileStatuses.clear();
      inMemoryOverrides.clear();
      rootDir = null;
      reloadPromise = null;
      readyPromise = Promise.resolve();
    },
    ready() {
      return readyPromise;
    },
    addClient(res: ServerResponse) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      clients.add(res);
      writeUpdate(res, buildStatusUpdateMessage());
      res.on("close", () => {
        clients.delete(res);
      });
    },
    getStatus(testId: string): ImportedTestCaseStatus {
      return inMemoryOverrides.get(testId) ?? fileStatuses.get(testId) ?? "unknown";
    },
    markDirty(testId: string) {
      inMemoryOverrides.set(testId, "unknown");
      broadcast(buildStatusUpdateMessage([{ id: testId, status: "unknown" }]));
    },
    async reloadForTests() {
      await reloadStatuses();
    },
  };

  async function reloadStatuses() {
    if (!rootDir) {
      return;
    }
    if (reloadPromise) {
      return reloadPromise;
    }
    reloadPromise = (async () => {
      const nextStatuses = await loadStatuses(rootDir!);
      fileStatuses.clear();
      for (const [id, status] of nextStatuses) {
        fileStatuses.set(id, status);
        inMemoryOverrides.delete(id);
      }
      broadcast(buildStatusUpdateMessage());
    })().finally(() => {
      reloadPromise = null;
    });
    return reloadPromise;
  }

  function broadcast(message: StatusUpdateMessage) {
    for (const client of clients) {
      writeUpdate(client, message);
    }
  }

  function buildStatusUpdateMessage(
    overrideStatuses?: Array<{ id: string; status: ImportedTestCaseStatus }>,
  ): StatusUpdateMessage {
    if (overrideStatuses) {
      return { statuses: overrideStatuses };
    }
    const combinedStatuses = new Map(fileStatuses);
    for (const [id, status] of inMemoryOverrides) {
      combinedStatuses.set(id, status);
    }
    return {
      statuses: [...combinedStatuses.entries()]
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
        .map(([id, status]) => ({ id, status })),
    };
  }
}

function watchStatusRoot(root: string, onChange: () => void) {
  return watch(root, (_, filename) => {
    if (String(filename) === DEFAULT_STATUS_FILE) {
      onChange();
    }
  });
}

function writeStatusUpdate(res: ServerResponse, message: StatusUpdateMessage) {
  res.write(`event: test-statuses\n`);
  res.write(`data: ${JSON.stringify(message)}\n\n`);
}

export default defineConfig({
  plugins: [testImportPlugin()],
});
