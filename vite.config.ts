import type { IncomingMessage, ServerResponse } from "node:http";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { defineConfig, type Plugin } from "vite";

type ImportedTestCase = {
  id: string;
  file: string;
  describe: string;
  title: string;
  request: unknown;
  start: number;
  end: number;
};

function testImportPlugin(): Plugin {
  return {
    name: "test-import-browser",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url;
        if (!url?.startsWith("/__test-import/cases")) {
          next();
          return;
        }

        try {
          const cases = await collectImportableTestCases(server.config.root);
          if (url === "/__test-import/cases") {
            sendJson(
              res,
              cases.map(({ id, file, describe, title }) => ({ id, file, describe, title })),
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

async function collectImportableTestCases(root: string) {
  const srcDir = path.join(root, "src");
  const files = await findTestFiles(srcDir);
  const cases = await Promise.all(files.map(async (filePath) => parseImportableCases(root, filePath)));
  return cases.flat();
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

async function parseImportableCases(root: string, filePath: string): Promise<ImportedTestCase[]> {
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
            const describeTitle = describeStack.at(-1) ?? relativeFile;
            const id = `${relativeFile}::${describeTitle}::${title}`;
            cases.push({
              id,
              file: relativeFile,
              describe: describeTitle,
              title,
              request: requestObject,
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

export default defineConfig({
  plugins: [testImportPlugin()],
});
