"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ExtractRunnerSnapshot } from "@/lib/extract-local-runner-types";

export function ExtractAdminPanel() {
  const [businessType, setBusinessType] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [keepFiles, setKeepFiles] = useState(false);
  const [includeTasks, setIncludeTasks] = useState(false);
  const [maxFiles, setMaxFiles] = useState("");
  const [status, setStatus] = useState<ExtractRunnerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/extract-local");
      if (res.status === 404) {
        setError("Admin API is not available (not running locally).");
        return;
      }
      if (!res.ok) {
        setError(`Status check failed (${res.status})`);
        return;
      }
      setStatus((await res.json()) as ExtractRunnerSnapshot);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach admin API.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2000);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/extract-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: businessType.trim() || undefined,
          dryRun,
          keepFiles,
          includeTasks,
          maxFiles: maxFiles.trim() ? Number.parseInt(maxFiles, 10) : undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
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
          Local scrape — NDJSON to Supabase
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ingest Google Maps Extractor cache (
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.ndjson</code>
          ) into{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            businesses_nowebsite
          </code>{" "}
          via{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            extract-local-extractor-cache.mjs
          </code>
          . Localhost only (
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

        <button
          type="submit"
          disabled={starting || status?.running}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {status?.running
            ? "Running…"
            : starting
              ? "Starting…"
              : "Run NDJSON ingest"}
        </button>
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
