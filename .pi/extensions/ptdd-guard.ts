import { isToolCallEventType, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { Type } from "typebox";

type ExpectedOutcome = "fail" | "pass";
type GuardPhase =
  | "idle"
  | "iteration-started"
  | "prediction-recorded"
  | "test-result-awaiting-actual"
  | "red-confirmed"
  | "green-confirmed"
  | "unexpected-result";

type GuardState = {
  phase: GuardPhase;
  behavior?: string;
  acceptanceCriteria?: string;
  predictedCommand?: string;
  expectedOutcome?: ExpectedOutcome;
  predictedReason?: string;
  predictedExpected?: string;
  predictedActual?: string;
  predictedFailureMessage?: string;
  lastActual?: string;
  lastMatch?: boolean;
  lastMismatchExplanation?: string;
};

const state: GuardState = { phase: "idle" };

const phaseEmoji: Record<GuardPhase, string> = {
  idle: "⚪",
  "iteration-started": "🧪",
  "prediction-recorded": "🔮",
  "test-result-awaiting-actual": "⏳",
  "red-confirmed": "🔴",
  "green-confirmed": "🟢",
  "unexpected-result": "⚠️",
};

const phaseLabel: Record<GuardPhase, string> = {
  idle: "idle",
  "iteration-started": "iteration",
  "prediction-recorded": "predicted",
  "test-result-awaiting-actual": "record actual",
  "red-confirmed": "red",
  "green-confirmed": "green",
  "unexpected-result": "unexpected",
};

const testCommandPattern = /(^|\s)(\.\/scripts\/test\.sh|npm\s+run\s+test|npm\s+test|vitest|test:llm)(\s|$)/;
const typecheckCommandPattern = /(^|\s)(npm\s+run\s+(typecheck|type-check|check-types)|(npx\s+)?(tsc|vue-tsc))(\s|$)/;
const allowedBeforeRedPattern = /(\.test\.|\.spec\.|test-list\.md$|ptdd-log\.md$|_tasks\/|\.agents\/skills\/|\.pi\/extensions\/)/;

function resetIteration() {
  state.phase = "idle";
  state.behavior = undefined;
  state.acceptanceCriteria = undefined;
  state.predictedCommand = undefined;
  state.expectedOutcome = undefined;
  state.predictedReason = undefined;
  state.predictedExpected = undefined;
  state.predictedActual = undefined;
  state.predictedFailureMessage = undefined;
  state.lastActual = undefined;
  state.lastMatch = undefined;
  state.lastMismatchExplanation = undefined;
}

function isTestCommand(command: string) {
  return testCommandPattern.test(command);
}

function isTypecheckCommand(command: string) {
  return typecheckCommandPattern.test(command);
}

function isPredictionCommand(command: string, expectedOutcome: ExpectedOutcome) {
  if (isTestCommand(command)) return true;
  return expectedOutcome === "fail" && isTypecheckCommand(command);
}

function isGuardedTestLikeCommand(command: string) {
  return isTestCommand(command) || isTypecheckCommand(command);
}

function isAllowedBeforeRed(path: string) {
  return allowedBeforeRedPattern.test(path);
}

function shorten(text: string, maxLength = 28) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function updateStatus(ctx: ExtensionContext) {
  const phase = `${phaseEmoji[state.phase]} PTDD ${phaseLabel[state.phase]}`;
  const behavior = state.behavior ? ` · ${shorten(state.behavior)}` : "";
  ctx.ui.setStatus("ptdd-guard", phase + behavior);
}

function statusText() {
  return [
    `phase=${state.phase}`,
    state.behavior ? `behavior=${state.behavior}` : undefined,
    state.expectedOutcome ? `expected=${state.expectedOutcome}` : undefined,
    state.predictedCommand ? `command=${state.predictedCommand}` : undefined,
    state.predictedReason ? `prediction=${state.predictedReason}` : undefined,
  ].filter(Boolean).join("; ");
}

function predictionError(params: {
  expectedOutcome: ExpectedOutcome;
  predictedReason: string;
  predictedExpected?: string;
  predictedActual?: string;
  predictedFailureMessage?: string;
}) {
  const reason = params.predictedReason.trim();
  if (reason.length < 20) {
    return "Prediction is too short. Predict a concrete outcome, e.g. the assertion expects 25 but current code returns 7.";
  }

  if (params.expectedOutcome !== "fail") return undefined;

  if (!params.predictedExpected?.trim() || !params.predictedActual?.trim()) {
    return "Failing predictions must include predictedExpected and predictedActual. Example: expects 25 but current code returns 7.";
  }

  const genericPredictionPattern = /^(it|this|the)?\s*(test\s+)?(should|will|is going to)?\s*fail(s|ing)?\s*(because)?\s*(it is )?(not implemented|missing|broken)?\.?$/i;
  if (genericPredictionPattern.test(reason) && !params.predictedFailureMessage?.trim()) {
    return "Prediction is too generic. Predict the concrete assertion/result mismatch or expected failure message.";
  }

  return undefined;
}

function truncateMiddle(text: string, maxLength = 50_000) {
  if (text.length <= maxLength) return text;
  const keep = Math.floor((maxLength - 100) / 2);
  return `${text.slice(0, keep)}\n\n... output truncated by ptdd_record_prediction (${text.length} chars total) ...\n\n${text.slice(-keep)}`;
}

function runPredictedCommand(command: string, cwd: string, signal?: AbortSignal) {
  return new Promise<{
    exitCode: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
    durationMs: number;
    timedOut: boolean;
  }>((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, 120_000);
    const abort = () => {
      child.kill("SIGTERM");
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.on("close", (exitCode, closeSignal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      resolve({
        exitCode,
        signal: closeSignal,
        stdout: truncateMiddle(stdout),
        stderr: truncateMiddle(stderr),
        durationMs: Date.now() - started,
        timedOut,
      });
    });
  });
}

function formatCommandResult(result: Awaited<ReturnType<typeof runPredictedCommand>>) {
  const parts = [
    `exitCode=${result.exitCode}${result.signal ? ` signal=${result.signal}` : ""}${result.timedOut ? " timedOut=true" : ""}`,
    `durationMs=${result.durationMs}`,
  ];
  if (result.stdout.trim()) parts.push(`stdout:\n${result.stdout}`);
  if (result.stderr.trim()) parts.push(`stderr:\n${result.stderr}`);
  return parts.join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    updateStatus(ctx);
  });

  pi.registerTool({
    name: "ptdd_start_iteration",
    label: "PTDD Start Iteration",
    description: "Start one PTDD iteration for exactly one behavior before writing/running tests.",
    parameters: Type.Object({
      behavior: Type.String({ description: "The single behavior under test in this iteration." }),
      acceptanceCriteria: Type.String({ description: "Observable acceptance criteria for this one behavior." }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      state.phase = "iteration-started";
      state.behavior = params.behavior;
      state.acceptanceCriteria = params.acceptanceCriteria;
      state.predictedCommand = undefined;
      state.expectedOutcome = undefined;
      state.predictedReason = undefined;
      state.predictedExpected = undefined;
      state.predictedActual = undefined;
      state.predictedFailureMessage = undefined;
      state.lastActual = undefined;
      state.lastMatch = undefined;
      state.lastMismatchExplanation = undefined;
      updateStatus(ctx);
      return {
        content: [{ type: "text", text: `PTDD iteration started: ${params.behavior}` }],
        details: { ...state },
      };
    },
  });

  pi.registerTool({
    name: "ptdd_record_prediction",
    label: "PTDD Predict And Run",
    description: "Record the required concrete test outcome prediction, run the exact test command, and report the command result for actual-outcome recording.",
    parameters: Type.Object({
      command: Type.String({ description: "The exact bash test command to run now." }),
      expectedOutcome: Type.Union([Type.Literal("fail"), Type.Literal("pass")]),
      predictedReason: Type.String({
        minLength: 20,
        description: "Concrete prediction of why the test will fail or pass. Must name the assertion/behavior, not just say it fails or passes.",
      }),
      predictedExpected: Type.Optional(Type.String({
        description: "For failing assertions: the value/result the new test expects, e.g. '25'. Required when expectedOutcome is 'fail'.",
      })),
      predictedActual: Type.Optional(Type.String({
        description: "For failing assertions: the current implementation result expected before the fix, e.g. '7'. Required when expectedOutcome is 'fail'.",
      })),
      predictedFailureMessage: Type.Optional(Type.String({
        description: "Expected failure message, matcher output, thrown error, or test name likely to fail.",
      })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (state.phase !== "iteration-started" && state.phase !== "red-confirmed" && state.phase !== "unexpected-result") {
        return {
          content: [{ type: "text", text: `Cannot record prediction while phase is ${state.phase}. Start an iteration first or resolve the current test result.` }],
          isError: true,
          details: { ...state },
        };
      }
      const error = predictionError(params);
      if (error) {
        return {
          content: [{ type: "text", text: error }],
          isError: true,
          details: { ...state },
        };
      }
      if (!isPredictionCommand(params.command, params.expectedOutcome)) {
        return {
          content: [{ type: "text", text: `ptdd_record_prediction only runs recognized test commands. Typecheck commands are allowed only for expectedOutcome=\"fail\". Got: ${params.command}` }],
          isError: true,
          details: { ...state },
        };
      }
      state.phase = "prediction-recorded";
      state.predictedCommand = params.command;
      state.expectedOutcome = params.expectedOutcome;
      state.predictedReason = params.predictedReason;
      state.predictedExpected = params.predictedExpected;
      state.predictedActual = params.predictedActual;
      state.predictedFailureMessage = params.predictedFailureMessage;
      state.lastActual = undefined;
      state.lastMatch = undefined;
      state.lastMismatchExplanation = undefined;
      updateStatus(ctx);

      try {
        const commandResult = await runPredictedCommand(params.command, ctx.cwd, signal);
        const actual = formatCommandResult(commandResult);
        state.phase = "test-result-awaiting-actual";
        updateStatus(ctx);
        return {
          content: [{
            type: "text",
            text: [
              `PREDICTION recorded for: ${params.command}`,
              params.predictedReason,
              "",
              "Command result:",
              actual,
              "",
              "Next: call ptdd_record_actual with whether this matched the concrete prediction.",
            ].join("\n"),
          }],
          details: { state: { ...state }, commandResult, actual },
          isError: commandResult.timedOut,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        state.phase = "test-result-awaiting-actual";
        updateStatus(ctx);
        return {
          content: [{
            type: "text",
            text: `PREDICTION recorded for: ${params.command}\n${params.predictedReason}\n\nCommand execution failed before producing a test result: ${message}\n\nNext: call ptdd_record_actual with outcome=\"unexpected\" and match=false.`,
          }],
          details: { state: { ...state }, executionError: message },
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "ptdd_record_actual",
    label: "PTDD Record Actual",
    description: "Record ACTUAL and whether it matched the concrete predicted test outcome after the predicted test command has run.",
    parameters: Type.Object({
      actual: Type.String({ description: "What actually happened when the test command ran, including the failing assertion/message or pass summary." }),
      match: Type.Boolean({ description: "Whether the observed result matched the predicted outcome, reason, expected value, and actual value." }),
      outcome: Type.Union([
        Type.Literal("failed-as-expected"),
        Type.Literal("passed-as-expected"),
        Type.Literal("unexpected"),
      ]),
      mismatchExplanation: Type.Optional(Type.String({
        description: "Required when match is false. Explain exactly what differed from the prediction.",
      })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (state.phase !== "test-result-awaiting-actual") {
        return {
          content: [{ type: "text", text: `Cannot record actual while phase is ${state.phase}. Call ptdd_record_prediction first so it can run the predicted test command.` }],
          isError: true,
          details: { ...state },
        };
      }
      if (!params.match && !params.mismatchExplanation?.trim()) {
        return {
          content: [{ type: "text", text: "When match is false, provide mismatchExplanation explaining what differed from the prediction." }],
          isError: true,
          details: { ...state },
        };
      }
      const expectedOutcomeResult = state.expectedOutcome === "fail" ? "failed-as-expected" : "passed-as-expected";
      if (params.match && params.outcome !== expectedOutcomeResult) {
        return {
          content: [{ type: "text", text: `A matching ${state.expectedOutcome} prediction must record outcome=${expectedOutcomeResult}, got ${params.outcome}.` }],
          isError: true,
          details: { ...state },
        };
      }
      state.lastActual = params.actual;
      state.lastMatch = params.match;
      state.lastMismatchExplanation = params.mismatchExplanation;
      if (!params.match || params.outcome === "unexpected") {
        state.phase = "unexpected-result";
      } else if (params.outcome === "failed-as-expected") {
        state.phase = "red-confirmed";
      } else {
        state.phase = "green-confirmed";
      }
      updateStatus(ctx);
      return {
        content: [{ type: "text", text: `ACTUAL recorded. MATCH: ${params.match ? "✅" : "❌"}. phase=${state.phase}` }],
        details: { ...state },
      };
    },
  });

  pi.registerTool({
    name: "ptdd_finish_iteration",
    label: "PTDD Finish Iteration",
    description: "Finish a PTDD iteration after green has been confirmed, or reset after a stop condition.",
    parameters: Type.Object({
      resolution: Type.String({ description: "Short summary of the completed behavior or stop reason." }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const previous = { ...state };
      resetIteration();
      updateStatus(ctx);
      return {
        content: [{ type: "text", text: `PTDD iteration finished: ${params.resolution}` }],
        details: { previous, current: { ...state } },
      };
    },
  });

  pi.registerTool({
    name: "ptdd_status",
    label: "PTDD Status",
    description: "Show the current PTDD guard state.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      updateStatus(ctx);
      return {
        content: [{ type: "text", text: statusText() }],
        details: { ...state },
      };
    },
  });

  pi.on("tool_call", async (event) => {
    if (isToolCallEventType("bash", event)) {
      const command = event.input.command;
      if (!isGuardedTestLikeCommand(command)) return undefined;
      if (state.phase === "idle") return undefined;
      return {
        block: true,
        reason: `PTDD guard blocked direct test command. ptdd_record_prediction now records the prediction, runs the test command itself, and reports the result. Current ${statusText()}`,
      };
    }

    if ((event.toolName === "write" || event.toolName === "edit") && state.phase !== "idle") {
      const path = typeof event.input.path === "string" ? event.input.path : "";
      if (isAllowedBeforeRed(path)) return undefined;
      if (state.phase === "red-confirmed" || state.phase === "green-confirmed") return undefined;
      return {
        block: true,
        reason: `PTDD guard blocked production edit before a matching red test. Current ${statusText()}`,
      };
    }

    return undefined;
  });
}
