import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
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
  prediction?: string;
  lastActual?: string;
  lastMatch?: boolean;
};

const state: GuardState = { phase: "idle" };

const testCommandPattern = /(^|\s)(\.\/scripts\/test\.sh|npm\s+run\s+test|npm\s+test|vitest)(\s|$)/;
const allowedBeforeRedPattern = /(\.test\.|\.spec\.|test-list\.md$|ptdd-log\.md$|_tasks\/|\.agents\/skills\/|\.pi\/extensions\/)/;

function resetIteration() {
  state.phase = "idle";
  state.behavior = undefined;
  state.acceptanceCriteria = undefined;
  state.predictedCommand = undefined;
  state.expectedOutcome = undefined;
  state.prediction = undefined;
  state.lastActual = undefined;
  state.lastMatch = undefined;
}

function isTestCommand(command: string) {
  return testCommandPattern.test(command);
}

function isAllowedBeforeRed(path: string) {
  return allowedBeforeRedPattern.test(path);
}

function statusText() {
  return [
    `phase=${state.phase}`,
    state.behavior ? `behavior=${state.behavior}` : undefined,
    state.expectedOutcome ? `expected=${state.expectedOutcome}` : undefined,
    state.predictedCommand ? `command=${state.predictedCommand}` : undefined,
  ].filter(Boolean).join("; ");
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "ptdd_start_iteration",
    label: "PTDD Start Iteration",
    description: "Start one PTDD iteration for exactly one behavior before writing/running tests.",
    parameters: Type.Object({
      behavior: Type.String({ description: "The single behavior under test in this iteration." }),
      acceptanceCriteria: Type.String({ description: "Observable acceptance criteria for this one behavior." }),
    }),
    async execute(_toolCallId, params) {
      state.phase = "iteration-started";
      state.behavior = params.behavior;
      state.acceptanceCriteria = params.acceptanceCriteria;
      state.predictedCommand = undefined;
      state.expectedOutcome = undefined;
      state.prediction = undefined;
      state.lastActual = undefined;
      state.lastMatch = undefined;
      return {
        content: [{ type: "text", text: `PTDD iteration started: ${params.behavior}` }],
        details: { ...state },
      };
    },
  });

  pi.registerTool({
    name: "ptdd_record_prediction",
    label: "PTDD Record Prediction",
    description: "Record the required prediction immediately before running the exact test command.",
    parameters: Type.Object({
      command: Type.String({ description: "The exact bash test command that will be run next." }),
      expectedOutcome: Type.Union([Type.Literal("fail"), Type.Literal("pass")]),
      prediction: Type.String({ description: "Specific prediction of the failure or pass result." }),
    }),
    async execute(_toolCallId, params) {
      if (state.phase !== "iteration-started" && state.phase !== "red-confirmed") {
        return {
          content: [{ type: "text", text: `Cannot record prediction while phase is ${state.phase}. Start an iteration first.` }],
          isError: true,
          details: { ...state },
        };
      }
      state.phase = "prediction-recorded";
      state.predictedCommand = params.command;
      state.expectedOutcome = params.expectedOutcome;
      state.prediction = params.prediction;
      state.lastActual = undefined;
      state.lastMatch = undefined;
      return {
        content: [{ type: "text", text: `PREDICTION recorded for: ${params.command}` }],
        details: { ...state },
      };
    },
  });

  pi.registerTool({
    name: "ptdd_record_actual",
    label: "PTDD Record Actual",
    description: "Record ACTUAL and MATCH after the predicted test command has run.",
    parameters: Type.Object({
      actual: Type.String({ description: "What actually happened when the test command ran." }),
      match: Type.Boolean({ description: "Whether actual result matched the prediction." }),
      outcome: Type.Union([
        Type.Literal("failed-as-expected"),
        Type.Literal("passed-as-expected"),
        Type.Literal("unexpected"),
      ]),
    }),
    async execute(_toolCallId, params) {
      if (state.phase !== "test-result-awaiting-actual") {
        return {
          content: [{ type: "text", text: `Cannot record actual while phase is ${state.phase}. Run the predicted test command first.` }],
          isError: true,
          details: { ...state },
        };
      }
      state.lastActual = params.actual;
      state.lastMatch = params.match;
      if (!params.match || params.outcome === "unexpected") {
        state.phase = "unexpected-result";
      } else if (params.outcome === "failed-as-expected") {
        state.phase = "red-confirmed";
      } else {
        state.phase = "green-confirmed";
      }
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
    async execute(_toolCallId, params) {
      const previous = { ...state };
      resetIteration();
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
    async execute() {
      return {
        content: [{ type: "text", text: statusText() }],
        details: { ...state },
      };
    },
  });

  pi.on("tool_call", async (event) => {
    if (isToolCallEventType("bash", event)) {
      const command = event.input.command;
      if (!isTestCommand(command)) return undefined;
      if (state.phase === "idle") return undefined;
      if (state.phase !== "prediction-recorded") {
        return {
          block: true,
          reason: `PTDD guard blocked test command. Record ptdd_record_prediction first. Current ${statusText()}`,
        };
      }
      if (command !== state.predictedCommand) {
        return {
          block: true,
          reason: `PTDD guard blocked test command. Predicted command was ${JSON.stringify(state.predictedCommand)}, got ${JSON.stringify(command)}.`,
        };
      }
      state.phase = "test-result-awaiting-actual";
      return undefined;
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
