import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const STATUS_KEY = "sleep-guard";
const ACTIVE_STATUS = "☕";
const INACTIVE_STATUS = "💤";
const EXTERNAL_CAFFEINATE_STATUS = "☕🧟";

let caffeinateProcess: ChildProcess | undefined;
let pollTimer: NodeJS.Timeout | undefined;
let shouldBeActive = false;
let ownCaffeinatePids = new Set<number>();
let externalCaffeinatePids: number[] = [];

function formatPids(pids: Iterable<number>) {
	return `[${Array.from(pids).sort((a, b) => a - b).join(",")}]`;
}

function updateStatus(ctx: ExtensionContext) {
	const ownPids = formatPids(ownCaffeinatePids);

	if (externalCaffeinatePids.length > 0) {
		ctx.ui.setStatus(
			STATUS_KEY,
			`${ACTIVE_STATUS}${ownPids}${EXTERNAL_CAFFEINATE_STATUS.slice(ACTIVE_STATUS.length)}${formatPids(externalCaffeinatePids)}`,
		);
		return;
	}

	ctx.ui.setStatus(STATUS_KEY, `${shouldBeActive ? ACTIVE_STATUS : INACTIVE_STATUS}${ownPids}`);
}

function isProcessRunning(child: ChildProcess | undefined) {
	return child !== undefined && !child.killed && child.exitCode === null && child.signalCode === null;
}

async function detectExternalCaffeinate(ctx: ExtensionContext, additionalOwnPid?: number) {
	try {
		const result = await execFileAsync("pgrep", ["-x", "caffeinate"]);
		const pids = result.stdout
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((pid) => Number(pid))
			.filter((pid) => Number.isInteger(pid) && pid > 0);

		if (isProcessRunning(caffeinateProcess) && caffeinateProcess.pid !== undefined) {
			ownCaffeinatePids.add(caffeinateProcess.pid);
		}
		if (additionalOwnPid !== undefined) ownCaffeinatePids.add(additionalOwnPid);

		const runningPids = new Set(pids);
		ownCaffeinatePids = new Set(Array.from(ownCaffeinatePids).filter((pid) => runningPids.has(pid)));
		externalCaffeinatePids = pids.filter((pid) => !ownCaffeinatePids.has(pid));
	} catch (error) {
		// pgrep exits non-zero when no process matches.
		const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
		if (code === 1) {
			ownCaffeinatePids.clear();
			externalCaffeinatePids = [];
		}
	}

	updateStatus(ctx);
}

async function startCaffeinate(ctx: ExtensionContext) {
	shouldBeActive = true;
	updateStatus(ctx);

	if (isProcessRunning(caffeinateProcess)) {
		await detectExternalCaffeinate(ctx);
		return;
	}

	const child = spawn("caffeinate", ["-i"], {
		stdio: "ignore",
	});

	caffeinateProcess = child;
	if (child.pid !== undefined) ownCaffeinatePids.add(child.pid);

	child.on("error", (error) => {
		if (caffeinateProcess === child) caffeinateProcess = undefined;
		if (child.pid !== undefined) ownCaffeinatePids.delete(child.pid);
		shouldBeActive = false;
		updateStatus(ctx);
		ctx.ui.notify(`Sleep guard failed to start caffeinate: ${error.message}`, "error");
	});

	child.on("exit", (code, signal) => {
		if (caffeinateProcess === child) caffeinateProcess = undefined;
		if (child.pid !== undefined) ownCaffeinatePids.delete(child.pid);

		if (shouldBeActive) {
			shouldBeActive = false;
			updateStatus(ctx);
			ctx.ui.notify(
				`Sleep guard caffeinate exited unexpectedly${signal ? ` by ${signal}` : code !== null ? ` with code ${code}` : ""}.`,
				"warning",
			);
		}
	});

	await detectExternalCaffeinate(ctx);
}

async function stopCaffeinate(ctx?: ExtensionContext) {
	shouldBeActive = false;

	const child = caffeinateProcess;
	caffeinateProcess = undefined;

	if (isProcessRunning(child)) {
		child.kill("SIGTERM");
	}

	if (ctx) await detectExternalCaffeinate(ctx, child?.pid);
}

function startPolling(ctx: ExtensionContext) {
	stopPolling();
	pollTimer = setInterval(() => {
		void detectExternalCaffeinate(ctx);
	}, 10_000);
}

function stopPolling() {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = undefined;
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		shouldBeActive = false;
		startPolling(ctx);
		await detectExternalCaffeinate(ctx);
	});

	pi.on("agent_start", async (_event, ctx) => {
		await startCaffeinate(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		await stopCaffeinate(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopPolling();
		await stopCaffeinate(ctx);
	});
}
