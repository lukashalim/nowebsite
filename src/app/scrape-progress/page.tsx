import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
} from "lucide-react";
import { z } from "zod";
import {
  fetchExtractLocalCacheRuns,
  type ExtractLocalCacheRunRow,
} from "@/lib/extract-cache-runs";
import {
  fetchScrapeJobsRecent,
  fetchScrapeJobsSummary,
  type ScrapeJobRow,
} from "@/lib/scrape-jobs";
import {
  fetchRecentBatches,
  type ScrapeBatchRow,
} from "@/lib/country-batch";
import { isLocalAdminEnabled } from "@/lib/local-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scrape queue progress",
  description:
    "Botasaurus scrape jobs for nowebsite — status and when rows were loaded into businesses.",
  robots: { index: false, follow: false },
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const scrapeProgressSearchSchema = z.object({
  limit: z.preprocess((val) => {
    if (val === undefined || val === "") return 100;
    const n = Number.parseInt(String(val), 10);
    return Number.isFinite(n) ? n : 100;
  }, z.number().int().min(1).max(500)),
});

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

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

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatWhen(iso);
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "pending") {
    return "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100";
  }
  if (s === "in_progress" || s === "running") {
    return "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100";
  }
  if (s === "completed") {
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
  }
  if (s === "failed") {
    return "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100";
  }
  if (s === "skipped" || s === "cancelled") {
    return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
  return "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100";
}

function BatchRow({ row }: { row: ScrapeBatchRow }) {
  const done = row.completed_locations + row.failed_locations;
  const pct =
    row.total_locations > 0
      ? Math.round((done / row.total_locations) * 100)
      : 0;
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
        #{row.id}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
        {formatWhen(row.created_at)}
      </td>
      <td className="max-w-[140px] truncate px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200">
        {row.business_type}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400">
        {row.strategy}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-center text-sm">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
        >
          {row.status}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        {done}/{row.total_locations} ({pct}%)
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
        {row.rows_emitted}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-zinc-500 dark:text-zinc-500">
        {formatRelative(row.updated_at)}
      </td>
    </tr>
  );
}

function JobRow({ row }: { row: ScrapeJobRow }) {
  const waitingPipeline =
    row.status.toLowerCase() === "completed" && row.loaded_at == null;
  return (
    <tr
      className={
        waitingPipeline
          ? "border-b border-amber-100 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
          : "border-b border-zinc-100 dark:border-zinc-800"
      }
    >
      <td className="whitespace-nowrap px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
        {formatWhen(row.created_at)}
      </td>
      <td className="max-w-[160px] truncate px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200">
        {row.business_type}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
        {row.zip_code ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
        {row.task_id}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-center text-sm">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
        >
          {row.status}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
        {row.loaded_at ? formatWhen(row.loaded_at) : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-zinc-500 dark:text-zinc-500">
        {formatRelative(row.updated_at)}
      </td>
    </tr>
  );
}

function ndjsonRunStatus(run: ExtractLocalCacheRunRow): string {
  if (run.exit_code === 0 && run.upsert_batch_errors === 0) {
    return "OK";
  }
  return `Exit ${run.exit_code}`;
}

interface SummaryCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  highlight?: boolean;
  subtitle?: string;
}

function SummaryCard({
  title,
  value,
  icon,
  highlight,
  subtitle,
}: SummaryCardProps) {
  return (
    <div
      className={
        highlight
          ? "rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30"
          : "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {title}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div
          className={
            highlight
              ? "text-amber-600 dark:text-amber-400"
              : "text-zinc-400 dark:text-zinc-500"
          }
          aria-hidden
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default async function ScrapeProgressPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const parsed = scrapeProgressSearchSchema.safeParse({
    limit: firstParam(raw.limit),
  });
  const limit = parsed.success ? parsed.data.limit : 100;
  const parseIssues = parsed.success ? [] : parsed.error.issues;

  const [
    { rows, error: rowsError },
    { summary, error: summaryError },
    { rows: ndjsonRuns, error: ndjsonError },
    { batches, error: batchesError },
  ] =
    await Promise.all([
      fetchScrapeJobsRecent(limit),
      fetchScrapeJobsSummary(),
      fetchExtractLocalCacheRuns(20),
      fetchRecentBatches(15),
    ]);

  const summaryLoadError = summaryError;
  const rowsLoadError = rowsError;
  const latestNdjsonRun = ndjsonRuns[0] ?? null;

  const querySuffix = limit !== 100 ? `?limit=${limit}` : "";
  const showLocalAdmin = isLocalAdminEnabled();

  return (
    <div className="mx-auto max-w-[1400px] flex-1 p-4 sm:p-6">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link
            href="/crm"
            className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            ← CRM
          </Link>
          {showLocalAdmin ? (
            <>
              {" · "}
              <Link
                href="/admin/scrape"
                className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                Local scrape admin
              </Link>
            </>
          ) : null}
          {" · "}
          <Link
            href="/extract-progress"
            className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            Extractor progress
          </Link>
          {" · "}
          <Link
            href={`/scrape-progress${querySuffix}`}
            className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            Refresh
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Scrape queue progress
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Rows in{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            scrape_jobs_nowebsite
          </code>
          .{" "}
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">
            Loaded
          </strong>{" "}
          means <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">loaded_at</code> was set when{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            scrape/pipeline.mjs
          </code>{" "}
          wrote matching leads into the{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            businesses
          </code>{" "}
          table.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Showing last{" "}
          <Link
            href="/scrape-progress?limit=100"
            className={limit === 100 ? "font-semibold text-zinc-700 dark:text-zinc-300" : "underline"}
          >
            100
          </Link>
          ,{" "}
          <Link
            href="/scrape-progress?limit=200"
            className={limit === 200 ? "font-semibold text-zinc-700 dark:text-zinc-300" : "underline"}
          >
            200
          </Link>
          , or{" "}
          <Link
            href="/scrape-progress?limit=500"
            className={limit === 500 ? "font-semibold text-zinc-700 dark:text-zinc-300" : "underline"}
          >
            500
          </Link>{" "}
          jobs by id (newest first).
        </p>
      </header>

      {parseIssues.length > 0 ? (
        <div
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          <p className="font-medium">Invalid query</p>
          <ul className="mt-2 list-inside list-disc">
            {parseIssues.map((issue) => (
              <li key={`${issue.path.join(".")}-${issue.message}`}>
                {issue.path.length ? `${issue.path.join(".")}: ` : ""}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summaryLoadError ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          <p className="font-medium">Could not load scrape queue summary</p>
          <p className="mt-1 opacity-90">{summaryLoadError}</p>
          <p className="mt-2 text-xs opacity-80">
            Set{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            in{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
              .env.local
            </code>
            . Apply{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
              scrape/sql/create-scrape-jobs-nowebsite.sql
            </code>{" "}
            if the table is missing.
          </p>
        </div>
      ) : summary ? (
        <>
          <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              title="Pending"
              value={summary.byStatus.pending ?? 0}
              icon={<Clock className="size-5" />}
            />
            <SummaryCard
              title="In progress"
              value={summary.byStatus.in_progress ?? 0}
              icon={<Loader2 className="size-5" />}
            />
            <SummaryCard
              title="Completed — waiting for pipeline"
              value={summary.completedNotLoaded}
              icon={<CheckCircle2 className="size-5" />}
              highlight={summary.completedNotLoaded > 0}
              subtitle="completed & loaded_at empty"
            />
            <SummaryCard
              title="Loaded into DB"
              value={summary.loadedTotal}
              icon={<Database className="size-5" />}
              subtitle="loaded_at set"
            />
            <SummaryCard
              title="Last activity"
              value={formatRelative(summary.lastUpdatedAt)}
              icon={<Activity className="size-5" />}
              subtitle={
                summary.lastUpdatedAt
                  ? formatWhen(summary.lastUpdatedAt)
                  : "no rows"
              }
            />
          </section>

          <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                Country batches (historical)
              </h2>
            </div>

            {batchesError ? (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                role="alert"
              >
                <p className="font-medium">Could not load country batches</p>
                <p className="mt-1 opacity-90">{batchesError}</p>
              </div>
            ) : batches.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                No country batches recorded.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                      <th className="px-3 py-2">Batch</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Strategy</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2">Locations</th>
                      <th className="px-3 py-2 text-right">Emitted</th>
                      <th className="px-3 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <BatchRow key={batch.id} row={batch} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                NDJSON ingest (local extractor cache)
              </h2>
              <Link
                href="/extract-progress"
                className="text-sm text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                Open full run history
              </Link>
            </div>

            {ndjsonError ? (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                role="alert"
              >
                <p className="font-medium">Could not load NDJSON run history</p>
                <p className="mt-1 opacity-90">{ndjsonError}</p>
              </div>
            ) : latestNdjsonRun ? (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard
                    title="Last run"
                    value={formatRelative(latestNdjsonRun.run_at)}
                    icon={<Activity className="size-5" />}
                    subtitle={formatWhen(latestNdjsonRun.run_at)}
                  />
                  <SummaryCard
                    title="Files scanned"
                    value={latestNdjsonRun.cache_files_scanned}
                    icon={<Database className="size-5" />}
                  />
                  <SummaryCard
                    title="Lines read"
                    value={latestNdjsonRun.lines_read}
                    icon={<Clock className="size-5" />}
                  />
                  <SummaryCard
                    title="Upserted"
                    value={latestNdjsonRun.businesses_upserted}
                    icon={<CheckCircle2 className="size-5" />}
                    highlight={latestNdjsonRun.businesses_upserted > 0}
                    subtitle={ndjsonRunStatus(latestNdjsonRun)}
                  />
                </div>
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full min-w-[760px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                        <th className="px-3 py-2">Run at</th>
                        <th className="px-3 py-2 text-right">Files</th>
                        <th className="px-3 py-2 text-right">Lines</th>
                        <th className="px-3 py-2 text-right">Upserted</th>
                        <th className="px-3 py-2 text-right">Batch err</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ndjsonRuns.slice(0, 5).map((run) => (
                        <tr
                          key={run.id}
                          className="border-b border-zinc-100 dark:border-zinc-800"
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                            {formatWhen(run.run_at)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                            {run.cache_files_scanned}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                            {run.lines_read}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                            {run.businesses_upserted}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                            {run.upsert_batch_errors}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {ndjsonRunStatus(run)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                No NDJSON runs logged yet.
              </p>
            )}
          </section>
          {(summary.byStatus.other ?? 0) > 0 ? (
            <p className="mb-4 text-sm text-violet-700 dark:text-violet-300">
              <strong className="font-medium">Other status:</strong>{" "}
              {summary.byStatus.other} job(s) with a status other than pending /
              in_progress / completed / failed.
            </p>
          ) : null}

          {rowsLoadError ? (
            <div
              className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
              role="alert"
            >
              <p className="font-medium">Could not load recent jobs</p>
              <p className="mt-1 opacity-90">{rowsLoadError}</p>
            </div>
          ) : null}

          {!rowsLoadError && rows.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
              No scrape jobs in the table yet.
            </p>
          ) : !rowsLoadError ? (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">ZIP</th>
                    <th className="px-3 py-2 text-right">Task</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2">Loaded</th>
                    <th className="px-3 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <JobRow key={r.id} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
