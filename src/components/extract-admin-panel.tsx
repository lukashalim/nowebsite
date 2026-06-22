"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ExtractRunnerSnapshot } from "@/lib/extract-local-runner-types";

const EXTRACT_LOCAL_API = "/api/extract-local";

async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return (await res.json()) as T;
}

export function ExtractAdminPanel() {
  const [businessType, setBusinessType] = useState("");
  const [country, setCountry] = useState<"" | "US" | "GB" | "AU">("");
  const [locationHint, setLocationHint] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [keepFiles, setKeepFiles] = useState(false);
  const [includeTasks, setIncludeTasks] = useState(false);
  const [maxFiles, setMaxFiles] = useState("");
  const [status, setStatus] = useState<ExtractRunnerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(EXTRACT_LOCAL_API);
      if (res.status === 404) {
        return;
      }
      if (!res.ok) {
        return;
      }
      const data = await readJsonResponse<ExtractRunnerSnapshot>(res);
      if (data) {
        setStatus(data);
      }
    } catch {
      // ignore transient poll errors
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2000);
    return () => clearInterval(id);
  }, [refresh]);

  async function startIngest(
    overrides: {
      includeTasks?: boolean;
      dryRun?: boolean;
    } = {},
  ) {
    const dryRunForRun = overrides.dryRun ?? dryRun;

    setStarting(true);
    setError(null);
    try {
      const res = await fetch(EXTRACT_LOCAL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: businessType.trim() || undefined,
          country: country || undefined,
          locationHint: locationHint.trim() || undefined,
          dryRun: dryRunForRun,
          keepFiles,
          includeTasks: overrides.includeTasks ?? includeTasks,
          maxFiles: maxFiles.trim() ? Number.parseInt(maxFiles, 10) : undefined,
        }),
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string }>(res);
      if (!data) {
        setError(
          `Server returned ${res.status} without JSON. Try restarting the dev server.`,
        );
      } else if (!res.ok) {
        setError(data.error ?? `Start failed (${res.status})`);
      } else {
        setStatus(data as ExtractRunnerSnapshot);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start request failed.");
    } finally {
      setStarting(false);
      void refresh();
    }
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    await startIngest();
  }

  const running = status?.running ?? false;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
      <header className="space-y-1">
        <p className="text-sm text-zinc-500">
          <Link href="/scrape-progress" className="underline hover:text-zinc-800">
            Scrape progress →
          </Link>
          {" · "}
          <Link href="/extract-progress" className="underline hover:text-zinc-800">
            Extract log
          </Link>
          {" · "}
          <Link href="/crm" className="underline hover:text-zinc-800">
            CRM
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Local ingest — Supabase
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ingest Google Maps Extractor NDJSON cache into{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            businesses_nowebsite
          </code>
          . Scrape in the desktop app first, then run ingest here. Localhost only (
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run dev</code>
          ).
        </p>
      </header>

      <form
        onSubmit={handleStart}
        className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Business type label
          </span>
          <input
            type="text"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder="e.g. restaurant (optional — default local_cache)"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Country (optional)
          </span>
          <select
            value={country}
            onChange={(e) =>
              setCountry(e.target.value as "" | "US" | "GB" | "AU")
            }
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          >
            <option value="">Detect per row</option>
            <option value="US">US</option>
            <option value="GB">United Kingdom (GB)</option>
            <option value="AU">Australia (AU)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Location hint (US ZIP, UK postcode, or AU postcode)
          </span>
          <input
            type="text"
            value={locationHint}
            onChange={(e) => setLocationHint(e.target.value)}
            placeholder="e.g. 60601, M1 1AA, or 2000"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Max NDJSON files (optional test limit)
          </span>
          <input
            type="number"
            min={1}
            value={maxFiles}
            onChange={(e) => setMaxFiles(e.target.value)}
            placeholder="all files"
            className="w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (no Supabase, no file delete)
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={keepFiles}
              onChange={(e) => setKeepFiles(e.target.checked)}
            />
            Keep NDJSON files
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeTasks}
              onChange={(e) => setIncludeTasks(e.target.checked)}
            />
            Include task_results/tasks
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={starting || running}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {running ? "Running…" : starting ? "Starting…" : "Run NDJSON ingest"}
          </button>
          <button
            type="button"
            disabled={starting || running}
            onClick={() => void startIngest({ includeTasks: true, dryRun: false })}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {running
              ? "Running…"
              : starting
                ? "Starting…"
                : "Run recovery ingest (include tasks)"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30">
          {error}
        </p>
      ) : null}

      {status ? (
        <section className="space-y-2">
          <div className="flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              Status:{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">
                {status.running ? "running" : "idle"}
              </strong>
            </span>
            {status.pid != null ? <span>PID {status.pid}</span> : null}
            {status.exitCode != null && !status.running ? (
              <span>Exit {status.exitCode}</span>
            ) : null}
          </div>
          <pre className="max-h-96 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 text-xs text-zinc-100">
            {status.logTail.length > 0
              ? status.logTail.join("\n")
              : "No log output yet."}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
