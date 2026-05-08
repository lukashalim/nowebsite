import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchExtractLocalCacheRuns,
  type ExtractLocalCacheRunRow,
} from "@/lib/extract-cache-runs";

export const metadata: Metadata = {
  title: "Extractor progress",
  description: "Scheduled local cache extract runs — counts and Supabase upserts.",
  robots: { index: false, follow: false },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(1)} s`;
}

function exitLabel(code: number): string {
  if (code === 0) {
    return "OK";
  }
  return `Exit ${code}`;
}

function RunRow({ r }: { r: ExtractLocalCacheRunRow }) {
  const ok = r.exit_code === 0 && r.upsert_batch_errors === 0;
  return (
    <tr
      className={
        ok
          ? "border-b border-zinc-100 dark:border-zinc-800"
          : "border-b border-amber-100 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
      }
    >
      <td className="whitespace-nowrap px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
        {formatWhen(r.run_at)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
        {formatDuration(r.duration_ms)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-center text-sm">
        <span
          className={
            ok
              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
              : "rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-800/50 dark:text-amber-100"
          }
        >
          {exitLabel(r.exit_code)}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        {r.cache_files_scanned}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        {r.lines_read}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        {r.skipped_has_website}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        {r.skipped_sweet_spot}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
        {r.matched_leads}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums font-medium text-emerald-800 dark:text-emerald-300">
        {r.businesses_upserted}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
        {r.upsert_batch_errors}
      </td>
      <td className="max-w-[200px] truncate px-3 py-2 text-xs text-zinc-500 dark:text-zinc-500" title={r.error_message ?? ""}>
        {r.dry_run ? "dry-run" : (r.businesses_target_table ?? "—")}
        {r.error_message ? ` · ${r.error_message}` : ""}
      </td>
    </tr>
  );
}

export default async function ExtractProgressPage() {
  const { rows, error } = await fetchExtractLocalCacheRuns(120);

  return (
    <div className="mx-auto max-w-[1400px] flex-1 p-4 sm:p-6">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link
            href="/"
            className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            ← CRM home
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Local extractor progress
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          One row per run of{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            extract-local-extractor-cache.mjs
          </code>{" "}
          (e.g. Task Scheduler).{" "}
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">
            Lines
          </strong>{" "}
          = NDJSON rows scanned;{" "}
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">
            Has website
          </strong>{" "}
          = skipped because a website was present;{" "}
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">
            Upserted
          </strong>{" "}
          = rows written to Supabase.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Apply{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            scrape/sql/create-extract-local-cache-runs.sql
          </code>{" "}
          in Supabase if this list is empty or shows a load error.
        </p>
      </header>

      {error ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          <p className="font-medium">Could not load run history</p>
          <p className="mt-1 opacity-90">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          No runs logged yet. After the SQL migration is applied, the next scheduled
          extract will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2 text-right">Duration</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">NDJSON files</th>
                <th className="px-3 py-2 text-right">Lines</th>
                <th className="px-3 py-2 text-right">Has website</th>
                <th className="px-3 py-2 text-right">Sweet spot</th>
                <th className="px-3 py-2 text-right">Matched</th>
                <th className="px-3 py-2 text-right">Upserted</th>
                <th className="px-3 py-2 text-right">Batch err</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RunRow key={r.id} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
