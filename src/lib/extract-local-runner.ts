import { spawn } from "node:child_process";
import path from "node:path";
import { loadSharedEnvLocal } from "@/lib/load-shared-env";
import type {
  ExtractRunnerSnapshot,
  ExtractStartOptions,
} from "@/lib/extract-local-runner-types";

export type { ExtractRunnerSnapshot, ExtractStartOptions } from "@/lib/extract-local-runner-types";

const MAX_LOG_LINES = 200;

const state: ExtractRunnerSnapshot = {
  running: false,
  pid: null,
  startedAt: null,
  exitCode: null,
  logTail: [],
  options: null,
};

function appendLog(text: string): void {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trimEnd();
    if (!t) continue;
    state.logTail.push(t);
    if (state.logTail.length > MAX_LOG_LINES) {
      state.logTail.shift();
    }
  }
}

export function getExtractRunnerSnapshot(): ExtractRunnerSnapshot {
  return {
    running: state.running,
    pid: state.pid,
    startedAt: state.startedAt,
    exitCode: state.exitCode,
    logTail: [...state.logTail],
    options: state.options ? { ...state.options } : null,
  };
}

export function startExtractLocal(
  options: ExtractStartOptions,
): { ok: true } | { ok: false; error: string } {
  if (state.running) {
    return { ok: false, error: "Extraction is already running." };
  }

  loadSharedEnvLocal();

  const scrapeDir = path.join(process.cwd(), "scrape");
  const scriptPath = path.join(scrapeDir, "extract-local-extractor-cache.mjs");
  const args = [scriptPath];

  const businessType = options.businessType?.trim();
  if (businessType) {
    args.push("--business-type", businessType);
  }
  if (options.dryRun) args.push("--dry-run");
  if (options.keepFiles) args.push("--keep-files");
  if (options.includeTasks) args.push("--include-tasks");
  if (options.maxFiles != null && options.maxFiles > 0) {
    args.push("--max-files", String(Math.floor(options.maxFiles)));
  }

  const env = { ...process.env };
  if (options.country) {
    env.EXTRACT_LOCAL_COUNTRY = options.country;
  }
  if (options.locationHint?.trim()) {
    env.EXTRACT_LOCAL_LOCATION_HINT = options.locationHint.trim();
  }

  const child = spawn(
    process.execPath,
    ["--import", "tsx", ...args],
    {
      cwd: scrapeDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  state.running = true;
  state.pid = child.pid ?? null;
  state.startedAt = new Date().toISOString();
  state.exitCode = null;
  state.logTail = [`> node --import tsx ${args.slice(1).join(" ")}`];
  state.options = { ...options };

  child.stdout?.on("data", (chunk: Buffer) => appendLog(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => appendLog(chunk.toString()));

  child.on("close", (code) => {
    state.running = false;
    state.exitCode = code;
    appendLog(`\nProcess exited with code ${code ?? "?"}`);
  });

  child.on("error", (err) => {
    appendLog(`spawn error: ${err.message}`);
    state.running = false;
    state.exitCode = 1;
  });

  return { ok: true };
}
